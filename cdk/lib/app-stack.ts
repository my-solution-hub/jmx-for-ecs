import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as iam from 'aws-cdk-lib/aws-iam'

export class EcsFargateAppStack extends cdk.Stack {
  constructor (scope: Construct, id: string, props?: any) {
    super(scope, id, props)

    // Create a Task Definition for demonstration
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonECSTaskExecutionRolePolicy'
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchAgentServerPolicy'
        )
      ]
    })

    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'CloudWatchAgentServerPolicy'
        )
      ]
    })
    // Create a security group for the service
    const serviceSecurityGroup = new ec2.SecurityGroup(
      this,
      'ServiceSecurityGroup',
      {
        vpc: props.vpc,
        allowAllOutbound: true,
        description: 'Security group for Fargate service'
      }
    )

    serviceSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    )

    this.createJmxApp(props, serviceSecurityGroup, executionRole, taskRole)
    this.createOtelApp(props, serviceSecurityGroup, executionRole, taskRole)
  }

  createOtelApp (
    props: any,
    serviceSecurityGroup: ec2.SecurityGroup,
    executionRole: iam.Role,
    taskRole: iam.Role
  ) {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'OtelTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: executionRole,
      taskRole: taskRole
    })
    let serviceName = 'otel-jmx-demo'
    const customNamespace = 'ecs-jmx-demo'
    const otelConfig = {
      receivers: {
        otlp: {
          protocols: {
            grpc: {
              endpoint: '0.0.0.0:4317'
            },
            http: {
              endpoint: '0.0.0.0:4318'
            }
          }
        }
      },
      processors: {
        batch: {},
        metricstransform: {
          // Force add service name as label to all metrics
          transforms: [
            {
              include: '.*',
              action: 'update',
              operations: [
                {
                  action: 'add_label',
                  new_label: 'ServiceName',
                  new_value: serviceName
                }
              ]
            }
          ]
        },
        // resource: {
        //   // Add service name as a resource attribute
        //   attributes: [
        //     {
        //       key: 'ServiceName',
        //       value: serviceName,
        //       action: 'insert'
        //     }
        //   ]
        // }
      },
      exporters: {
        awsemf: {
          namespace: customNamespace,
          log_group_name: `/aws/ecs/${customNamespace}`,
          dimension_rollup_option: 'NoDimensionRollup',
          // Direct mapping from metrics labels to dimensions
          resource_to_telemetry_conversion: {
            enabled: true
          },
          metric_declarations: [
            // Explicitly map from service_name label to ServiceName dimension
            {
              dimensions: [['ServiceName', 'jvm.memory.type']],
              metric_name_selectors: ['jvm.memory.*']
            },
            {
              dimensions: [['ServiceName', 'OTelLib']],
              metric_name_selectors: ['.+']
            },
            {
              dimensions: [['ServiceName']],
              metric_name_selectors: ['.+']
            }
          ]
        }
      },
      service: {
        pipelines: {
          metrics: {
            receivers: ['otlp'],
            processors: ['metricstransform', 'batch'],
            exporters: ['awsemf']
          }
        }
      }
    }

    // Add a dummy container for demonstration
    taskDefinition.addContainer('OtelContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.otelRepository),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'otel-container',
        logRetention: logs.RetentionDays.ONE_WEEK
      }),
      portMappings: [{ containerPort: 8080 }],
      environment: {
        OTEL_JMX_TARGET_SYSTEM: 'jvm',
        AWS_JMX_ENABLED: 'true',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
        AWS_JMX_EXPORTER_METRICS_ENDPOINT: 'http://localhost:4318',
        OTEL_SERVICE_NAME: serviceName,
        OTEL_RESOURCE_ATTRIBUTES: `service.name=${serviceName}`
      }
    })
    taskDefinition.addContainer('OtelCollectorContainer', {
      image: ecs.ContainerImage.fromRegistry(
        'public.ecr.aws/aws-observability/aws-otel-collector:v0.43.2'
      ),
      portMappings: [
        { containerPort: 2000 },
        { containerPort: 8125 },
        { containerPort: 4317 },
        { containerPort: 4318 }
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs-otel',
        logRetention: logs.RetentionDays.ONE_WEEK
      }),
      essential: true,
      environment: {
        AOT_CONFIG_CONTENT: JSON.stringify(otelConfig),
        SERVICE_NAME: serviceName
      }
    })
    // Create a Fargate service
    const service = new ecs.FargateService(this, 'JmxService', {
      cluster: props.cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [serviceSecurityGroup]
    })
  }

  createJmxApp (
    props: any,
    serviceSecurityGroup: ec2.SecurityGroup,
    executionRole: iam.Role,
    taskRole: iam.Role
  ) {
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'PromTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: executionRole,
      taskRole: taskRole
    })
    let serviceName = 'prom-jmx-demo'
    const customNamespace = 'ecs-jmx-demo'
    const otelConfig = {
      receivers: {
        prometheus: {
          config: {
            scrape_configs: [
              {
                job_name: 'jmx-metrics',
                sample_limit: 10000,
                scrape_interval: '15s',
                metrics_path: '/metrics',
                static_configs: [
                  {
                    targets: ['localhost:9404'],
                    labels: {
                      service: serviceName
                    }
                  }
                ]
              }
            ]
          }
        }
      },
      processors: {
        batch: {},
        metricstransform: {
          // Force add service name as label to all metrics
          transforms: [
            {
              include: '.*',
              action: 'update',
              operations: [
                {
                  action: 'add_label',
                  new_label: 'ServiceName',
                  new_value: serviceName
                }
              ]
            }
          ]
        },
        // resource: {
        //   // Add service name as a resource attribute
        //   attributes: [
        //     {
        //       key: 'ServiceName',
        //       value: serviceName,
        //       action: 'insert'
        //     }
        //   ]
        // }
      },
      exporters: {
        awsemf: {
          namespace: customNamespace,
          log_group_name: `/aws/ecs/${customNamespace}`,
          dimension_rollup_option: 'NoDimensionRollup',
          // Direct mapping from metrics labels to dimensions
          resource_to_telemetry_conversion: {
            enabled: true
          },
          metric_declarations: [
            // Explicitly map from service_name label to ServiceName dimension
            {
              dimensions: [['ServiceName']],
              metric_name_selectors: ['.+']
            },
            {
              dimensions: [['ServiceName', 'OTelLib']],
              metric_name_selectors: ['.+']
            }
          ]
        }
      },
      service: {
        pipelines: {
          metrics: {
            receivers: ['prometheus'],
            processors: ['metricstransform', 'batch'],
            exporters: ['awsemf']
          }
        }
      }
    }

    // Add a dummy container for demonstration
    taskDefinition.addContainer('PromContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.jmxRepository),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'prom-container',
        logRetention: logs.RetentionDays.ONE_WEEK
      }),
      portMappings: [{ containerPort: 8080 }, { containerPort: 9404 }],
      environment: {
      }
    })
    taskDefinition.addContainer('PromCollectorContainer', {
      image: ecs.ContainerImage.fromRegistry(
        'public.ecr.aws/aws-observability/aws-otel-collector:v0.43.2'
      ),
      portMappings: [
        { containerPort: 2000 },
        { containerPort: 8125 },
        { containerPort: 4317 },
        { containerPort: 4318 }
      ],
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'ecs-prom',
        logRetention: logs.RetentionDays.ONE_WEEK
      }),
      essential: true,
      environment: {
        AOT_CONFIG_CONTENT: JSON.stringify(otelConfig),
        SERVICE_NAME: serviceName
      }
    })
    // Create a Fargate service
    const service = new ecs.FargateService(this, 'PromService', {
      cluster: props.cluster,
      taskDefinition: taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      securityGroups: [serviceSecurityGroup]
    })
  }
}
