import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ecr from 'aws-cdk-lib/aws-ecr'

export class DockerStack extends cdk.Stack {
  promRepoSsmName: string
  otelRepoSsmName: string
  constructor (scope: Construct, id: string, props?: cdk.StackProps) {
    const stackName = `${id}-docker`
    super(scope, stackName, props)
    
    this.promRepoSsmName = `/${id}/promRepositoryName`
    this.otelRepoSsmName = `/${id}/otelRepositoryName`
    // Create ECR Repository
    const promRepository = new ecr.Repository(this, 'promRepository', {
      repositoryName: `${id}-prom-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
      autoDeleteImages: true // NOT recommended for production
    })

    const otelRepository = new ecr.Repository(this, 'otelRepository', {
      repositoryName: `${id}-otel-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production
      autoDeleteImages: true // NOT recommended for production
    })

    // store the repository URIs in SSM Parameter Store
    new cdk.aws_ssm.StringParameter(this, 'promRepositoryName', {
      parameterName: this.promRepoSsmName,
      stringValue: promRepository.repositoryName,
      description: 'The Prom app URI of the ECR repository',
      tier: cdk.aws_ssm.ParameterTier.STANDARD
    })
    new cdk.aws_ssm.StringParameter(this, 'otelRepositoryName', {
      parameterName: this.otelRepoSsmName,
      stringValue: otelRepository.repositoryName,
      description: 'The Otel app URI of the ECR repository',
      tier: cdk.aws_ssm.ParameterTier.STANDARD
    })
    // Output the ECR Repository URI
    new cdk.CfnOutput(this, 'jmxRepositoryURI', {
      value: promRepository.repositoryUri,
      description: 'The JMX app URI of the ECR repository'
    })

    new cdk.CfnOutput(this, 'otelRepositoryURI', {
      value: otelRepository.repositoryUri,
      description: 'The Otel app URI of the ECR repository'
    })
  }
}
