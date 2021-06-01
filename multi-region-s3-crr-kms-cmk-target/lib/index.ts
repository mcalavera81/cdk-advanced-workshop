import * as cdk from "@aws-cdk/core";
import * as kms from "@aws-cdk/aws-kms";
import * as s3 from "@aws-cdk/aws-s3";
import * as ssm from "@aws-cdk/aws-ssm";

export class MultiRegionS3CrrKmsCmkTarget extends cdk.Construct {
  public readonly targetBucket: s3.Bucket;
  public readonly targetKeyIdSsmParameterName: string;

  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    // Define construct contents here
    const targetKmsKey = new kms.Key(this, "MyTargetKey", {
      trustAccountIdentities: true, // delegate key permissions to IAM
    });
    /*
     *By setting trustAccountIdentities to true we are able to grant access
     * to the key by only using IAM. If we left this set to false we would
     * need to add permissions to access the key on both the KMS Key policy
     * and on the IAM policy.
     */

    const targetBucket = new s3.Bucket(this, "MyTargetBucket", {
      bucketName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: targetKmsKey,
      versioned: true,
    });

    /*
     * In some cases, such as when creating an AWS CDK app with cross-environment
     * references, physical names are required for the AWS CDK to function
     * correctly. In those cases, if you don’t want to bother with coming up
     *  with a physical name yourself, you can let the AWS CDK name it for you
     * by using the special value PhysicalName.GENERATE_IF_NEEDED
     * */

    const stack = cdk.Stack.of(this);
    const parameterName = `${stack.stackName}.MyTargetKeyId`;

    new ssm.StringParameter(this, "MyTargetKeyIdSSMParam", {
      parameterName: parameterName,
      description: "The KMS Key Id for the target stack",
      stringValue: targetKmsKey.keyArn,
    });

    this.targetBucket = targetBucket;
    this.targetKeyIdSsmParameterName = parameterName;

    /*
     * For dynamically generated values like they Key ARN, the value is
     * resolved at deployment time by AWS CloudFormation. The CDK does not yet
     * know the value at synthesis time. If the reference happens in the same
     * stack as the resource, the CDK handles this by turning the reference
     * into a CloudFormation intrinsic reference (i.e. "Ref": "MyTargetKey")
     * which can be natively resolved by CloudFormation at deployment time.
     * If the reference is cross stack, the CDK will automatically synthesize
     * CloudFormation exports in the producing stack and an Fn::ImportValue
     * in the consuming stack in order to transfer the information from one
     * stack to another.
     */

    /*
     *  CloudFormation cannot currently import values from a stack in another
     * environment (account and/or region) so in cases like this where we need
     * to pass the dynamically generated Key ARN to a stack in another region,
     * we are not able to simply pass a reference as targetKmsKey.keyArn.
     * Instead, we need to store the Key ARN in an SSM parameter which we can
     * lookup in the consuming stack.
     */

    /*
     * The targetBucket S3 Bucket is being referenced in a cross environment stack
     * just like the KMS Key ARN, so why are we able to reference it natively
     * rather than having to use another SSM Parameter? This is because we are
     * able to reference the bucket by name which is not a dynamically generated
     * value like the ARN is (due to using the PhysicalName.GENERATE_IF_NEEDED).
     *  This means that the S3 Bucket name is known by the CDK during synthesis.
     */
  }
}
