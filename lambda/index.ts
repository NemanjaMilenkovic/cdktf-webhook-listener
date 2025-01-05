import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDB } from 'aws-sdk';

interface WebhookPayload {
  [key: string]: any;
}
interface WebhookRecord {
  id: string;
  payload: WebhookPayload;
  timestamp: string;
  receivedAt: number;
}

const db = new DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME!;
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST'
};

export const handler = async (
  event: APIGatewayProxyEvent, 
  context: Context
): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing request body' })
      };
    }

    let body: WebhookPayload;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    const record: WebhookRecord = {
      id: context.awsRequestId,
      payload: body,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now()
    };

    // Store in db
    const params: DynamoDB.DocumentClient.PutItemInput = {
      TableName: TABLE_NAME,
      Item: record
    };
    await db.put(params).promise();

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Webhook received successfully',
        id: record.id,
        timestamp: record.timestamp
      })
    };

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        requestId: context.awsRequestId
      })
    };
  }
};