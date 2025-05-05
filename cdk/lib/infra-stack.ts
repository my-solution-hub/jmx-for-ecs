import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecr from 'aws-cdk-lib/aws-ecr'

export class EcsFargateClusterStack extends cdk.Stack {
  vpc: ec2.Vpc
  cluster: ecs.Cluster

  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    
    const stackName = `${id}-infra`
    super(scope, stackName, props)
    // Create a VPC
    this.vpc = new ec2.Vpc(this, 'MyVPC', {
      maxAzs: 2, // Default is all AZs in the region
      natGateways: 1
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
