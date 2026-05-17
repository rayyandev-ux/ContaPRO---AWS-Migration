import { CognitoJwtVerifier } from "aws-jwt-verify";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

// --- Cognito ---
let cognitoVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

export function getCognitoVerifier() {
  if (!cognitoVerifier && config.cognitoUserPoolId && config.cognitoClientId) {
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: config.cognitoUserPoolId,
      tokenUse: "access", // Or "id" based on your architecture
      clientId: config.cognitoClientId,
    });
  }
  return cognitoVerifier;
}

// --- Secrets Manager ---
const secretsClient = new SecretsManagerClient({ region: config.awsRegion });

export async function fetchAwsSecrets() {
  if (!config.awsSecretsManagerSecretId) return {};
  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: config.awsSecretsManagerSecretId,
        VersionStage: "AWSCURRENT",
      })
    );
    if (response.SecretString) {
      return JSON.parse(response.SecretString);
    }
    return {};
  } catch (error) {
    console.error("Error fetching secrets from AWS Secrets Manager:", error);
    return {};
  }
}

// --- S3 Presigned URLs ---
const s3Client = new S3Client({ region: config.awsRegion });

export async function generatePresignedUploadUrl(bucket: string, key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function generatePresignedDownloadUrl(bucket: string, key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}
