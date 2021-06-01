import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import * as kms from "@aws-cdk/aws-kms";
import * as cr from "@aws-cdk/custom-resources";
import * as iam from "@aws-cdk/aws-iam";

export interface MultiRegionS3CrrKmsCmkSourceProps {
  readonly targetBucket: s3.Bucket;
  readonly targetKeyIdSsmParameterName: string;
  readonly targetRegion: string;
}

export class MultiRegionS3CrrKmsCmkSource extends cdk.Construct {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: MultiRegionS3CrrKmsCmkSourceProps
  ) {
    super(scope, id);

    const sourceKmsKey = new kms.Key(this, "MySourceKey", {
      trustAccountIdentities: true, // delegate key permissions to IAM
    });

    const stack = cdk.Stack.of(this);

    const parameterArn = stack.formatArn({
      account: stack.account,
      region: props.targetRegion,
      resource: "parameter",
      resourceName: props.targetKeyIdSsmParameterName,
      service: "ssm",
    });

    const targetKeyLookupCR = new cr.AwsCustomResource(
      this,
      "TargetKeyLookup",
      {
        onUpdate: {
          // will also be called for a CREATE event
          service: "SSM",
          action: "getParameter",
          parameters: {
            Name: props.targetKeyIdSsmParameterName,
          },
          region: props.targetRegion,
          physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()),
        },
        policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
          resources: [parameterArn],
        }),
      }
    );
    /* We are leveraging an AWS CDK AwsCustomResource construct here to provide an
     * abstraction layer here allowing us to make simple AWS API calls.
     */

    const sourceBucket = new s3.Bucket(this, "MySourceBucket", {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: sourceKmsKey,
      versioned: true,
    });

    const role = new iam.Role(this, "MyCrrRole", {
      assumedBy: new iam.ServicePrincipal("s3.amazonaws.com"),
      path: "/service-role/",
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        resources: [sourceBucket.bucketArn],
        actions: ["s3:GetReplicationConfiguration", "s3:ListBucket"],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        resources: [sourceBucket.arnForObjects("*")],
        actions: [
          "s3:GetObjectVersion",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectLegalHold",
          "s3:GetObjectVersionTagging",
          "s3:GetObjectRetention",
        ],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        resources: [props.targetBucket.arnForObjects("*")],
        actions: [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags",
          "s3:GetObjectVersionTagging",
        ],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        resources: [sourceKmsKey.keyArn],
        actions: ["kms:Decrypt"],
      })
    );

    role.addToPolicy(
      new iam.PolicyStatement({
        resources: [targetKeyLookupCR.getResponseField("Parameter.Value")],
        actions: ["kms:Encrypt"],
      })
    );

    // Get the AWS CloudFormation resource
    const cfnBucket = sourceBucket.node.defaultChild as s3.CfnBucket;
    // Change its properties
    cfnBucket.replicationConfiguration = {
      role: role.roleArn,
      rules: [
        {
          destination: {
            bucket: props.targetBucket.bucketArn,
            encryptionConfiguration: {
              replicaKmsKeyId:
                targetKeyLookupCR.getResponseField("Parameter.Value"),
            },
          },
          sourceSelectionCriteria: {
            sseKmsEncryptedObjects: {
              status: "Enabled",
            },
          },
          status: "Enabled",
        },
      ],
    };
    /*
     * If a Construct is missing a feature or your are tring to work around an issue, you can modify the CFN Resource
     * that is encapsulated by the Construct. All Constructs contain within them the corresponding CFN Resource.
     * In this example, the high-level Bucket construct wraps the low-level CfnBucket construct.
     * Because the CfnBucket corresponds directly to the AWS CloudFormation resource, it exposes all features
     * that are available through AWS CloudFormation. The basic approach to get access to the CFN Resource class
     * is to use construct.node.defaultChild, cast it to the right type (if necessary), and modify its properties
     */
  }
}
