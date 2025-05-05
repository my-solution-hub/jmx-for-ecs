#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcsFargateClusterStack } from '../lib/infra-stack';
import { EcsFargateAppStack } from '../lib/app-stack';
import { DockerStack } from '../lib/docker-stack';

const scope = new cdk.App();
const STACK_NAME = process.env.STACK_NAME || 'ecs-fargate-jmx-demo';
const docker = new DockerStack(scope, STACK_NAME, {});
const infra = new EcsFargateClusterStack(scope, STACK_NAME, {});
const app = new EcsFargateAppStack(scope, STACK_NAME, {
  vpc: infra.vpc,
  cluster: infra.cluster,
  promRepoName: docker.promRepoSsmName,
  otelRepoName: docker.otelRepoSsmName

});

app.addDependency(docker);
app.addDependency(infra);