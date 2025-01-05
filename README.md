# webhook listener

This builds a webhook listener using AWS Lambda, which receives incoming HTTP events (like GitHub or Slack webhooks) and stores the event data in DynamoDB.

How to deploy the Project:

1. Install dependencies:

   `npm install`

2. Generate CDK Constructs for TF providers:

   `npx cdktf run`

3. Generate Terraform config in a folder:

   `npx cdktf synth`

   (generates Terraform files in the cdktf.out/)

4. Deploy to AWS:

   `npx cdktf deploy`

5. Test the API Endpoint (CDKTF should output the API Gateway URL):

`curl -X POST <API_URL>/webhook -d '{"event":"test"}' -H "Content-Type: application/json"`

Example API Request

```
curl -X POST <API_URL>/webhook \
-d '{"message": "hi from webhook!"}' \
-H "Content-Type: application/json"
```
