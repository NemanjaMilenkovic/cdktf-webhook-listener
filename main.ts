import { App, TerraformStack } from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamPolicy } from "@cdktf/provider-aws/lib/iam-policy";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { DynamodbTable } from "@cdktf/provider-aws/lib/dynamodb-table";
import { Apigatewayv2Api } from "@cdktf/provider-aws/lib/apigatewayv2-api";
import { Apigatewayv2Integration } from "@cdktf/provider-aws/lib/apigatewayv2-integration";
import { Apigatewayv2Route } from "@cdktf/provider-aws/lib/apigatewayv2-route";

class WebhookListenerStack extends TerraformStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    new AwsProvider(this, "aws", {
      region: "ap-northeast-1",
    });

    const table = new DynamodbTable(this, "WebhookTable", {
      name: "WebhookEvents",
      billingMode: "PAY_PER_REQUEST",
      attribute: [
        { name: "id", type: "S" },
        { name: "timestamp", type: "N" }
      ],
      hashKey: "id",
      globalSecondaryIndex: [{
        name: "TimestampIndex",
        hashKey: "timestamp",
        projectionType: "ALL"
      }],
      tags: {
        Environment: "production",
        Project: "webhook-listener"
      }
    });

    const role = new IamRole(this, "LambdaRole", {
      name: "webhook-listener-role",
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Action: "sts:AssumeRole",
            Principal: { Service: "lambda.amazonaws.com" },
            Effect: "Allow",
          },
        ],
      })
    });

    const dynamoPolicy = new IamPolicy(this, "DynamoDBPolicy", {
      name: "webhook-dynamodb-policy",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: [
              "dynamodb:PutItem",
              "dynamodb:GetItem",
              "dynamodb:Query",
              "dynamodb:Scan"
            ],
            Resource: [table.arn, `${table.arn}/index/*`]
          }
        ]
      })
    });

    new IamRolePolicyAttachment(this, "DynamoDBPolicyAttachment", {
      role: role.name,
      policyArn: dynamoPolicy.arn
    });

    new IamRolePolicyAttachment(this, "LambdaBasicExecution", {
      role: role.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
    });

    const fn = new LambdaFunction(this, "WebhookFunction", {
      filename: "./lambda/index.js",
      functionName: "webhook-listener",
      role: role.arn,
      runtime: "nodejs18.x",
      handler: "index.handler",
      timeout: 30,
      memorySize: 256,
      environment: {
        variables: {
          TABLE_NAME: table.name,
          NODE_ENV: "production"
        },
      },
      tags: {
        Environment: "production",
        Project: "webhook-listener"
      }
    });

    const api = new Apigatewayv2Api(this, "WebhookApi", {
      name: "webhook-listener-api",
      protocolType: "HTTP",
      target: fn.arn,
      corsConfiguration: {
        allowHeaders: ["content-type"],
        allowMethods: ["POST"],
        allowOrigins: ["*"]
      }
    });

    const integration = new Apigatewayv2Integration(this, "WebhookIntegration", {
      apiId: api.id,
      integrationType: "AWS_PROXY",
      integrationUri: fn.arn,
      integrationMethod: "POST",
      payloadFormatVersion: "2.0",
      timeoutMilliseconds: 30000
    });

    new Apigatewayv2Route(this, "WebhookRoute", {
      apiId: api.id,
      routeKey: "POST /webhook",
      target: `integrations/${integration.id}`
    });
  }
}

const app = new App();
new WebhookListenerStack(app, "webhook-listener");
app.synth();