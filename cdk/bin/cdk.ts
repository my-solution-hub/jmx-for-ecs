#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcsFargateClusterStack } from '../lib/infra-stack';
import { EcsFargateAppStack } from '../lib/app-stack';

const scope = new cdk.App();
const infra = new EcsFargateClusterStack(scope, 'ecs-fargate-jmx-demo', {
});
const app = new EcsFargateAppStack(scope, 'ecs-fargate-jmx-demo-app', {
  vpc: infra.vpc,
  cluster: infra.cluster,
  jmxRepository: infra.jmxRepository,
  otelRepository: infra.otelRepository
});