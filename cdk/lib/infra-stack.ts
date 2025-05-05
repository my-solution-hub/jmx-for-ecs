import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'
import * as iam from 'aws-cdk-lib/aws-iam';

export class EcsFargateClusterStack extends cdk.Stack {
  vpc: ec2.Vpc
  cluster: ecs.Cluster
  jmxRepository: ecr.Repository
  otelRepository: ecr.Repository

  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Create a VPC
    this.vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2, // Default is all AZs in the region
      natGateways: 1
    })

    // Create ECR Repository
    this.jmxRepository = new ecr.Repository(this, 'jmxRepository', {
      repositoryName: `${id}-jmx-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
      autoDeleteImages: true // NOT recommended for production
    })

    this.otelRepository = new ecr.Repository(this, 'otelRepository', {
      repositoryName: `${id}-otel-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
      autoDeleteImages: true // NOT recommended for production
    })

    // Create ECS Cluster with Container Insights enabled
    this.cluster = new ecs.Cluster(this, 'MyCluster', {
      vpc: this.vpc,
      clusterName: 'jmx-demo',
      containerInsights: true // Enable Container Insights
    })

    // Add Fargate capacity providers to the cluster
    this.cluster.enableFargateCapacityProviders()

    // Set default capacity provider strategy
    this.cluster.addDefaultCapacityProviderStrategy([
      {
        capacityProvider: 'FARGATE',
        weight: 1
      },
      {
        capacityProvider: 'FARGATE_SPOT',
        weight: 0
      }
    ])

    // Output the ECR Repository URI
    new cdk.CfnOutput(this, 'jmxRepositoryURI', {
      value: this.jmxRepository.repositoryUri,
      description: 'The JMX app URI of the ECR repository'
    })

    new cdk.CfnOutput(this, 'otelRepositoryURI', {
      value: this.otelRepository.repositoryUri,
      description: 'The Otel app URI of the ECR repository'
    })

    // Output the ECS Cluster Name
    new cdk.CfnOutput(this, 'ClusterName', {
      value: this.cluster.clusterName,
      description: 'The name of the ECS cluster'
    })

    // Output the VPC ID
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'The ID of the VPC'
    })
  }
}
