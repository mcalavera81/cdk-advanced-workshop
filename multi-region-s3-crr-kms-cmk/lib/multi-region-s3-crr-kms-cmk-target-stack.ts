import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import { MultiRegionS3CrrKmsCmkTarget } from "multi-region-s3-crr-kms-cmk-target";

export class MultiRegionS3CrrKmsCmkTargetStack extends cdk.Stack {
  public targetBucket: s3.Bucket;
  public targetKeyIdSsmParameterName: string;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const myTargetConstruct = new MultiRegionS3CrrKmsCmkTarget(
      this,
      "MyTarget"
    );

    this.targetBucket = myTargetConstruct.targetBucket;
    this.targetKeyIdSsmParameterName =
      myTargetConstruct.targetKeyIdSsmParameterName;
  }
}
