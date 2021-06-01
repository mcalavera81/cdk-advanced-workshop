import * as cdk from "@aws-cdk/core";
import * as s3 from "@aws-cdk/aws-s3";
import { MultiRegionS3CrrKmsCmkSource } from "multi-region-s3-crr-kms-cmk-source";

interface S3StaticMultiRegionSourceStackProps extends cdk.StackProps {
  targetBucket: s3.Bucket;
  targetKeyIdSsmParameterName: string;
  targetRegion: string;
}

export class MultiRegionS3CrrKmsCmkSourceStack extends cdk.Stack {
  constructor(
    scope: cdk.Construct,
    id: string,
    props: S3StaticMultiRegionSourceStackProps
  ) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const myTargetConstruct = new MultiRegionS3CrrKmsCmkSource(
      this,
      "MySource",
      {
        targetBucket: props.targetBucket,
        targetKeyIdSsmParameterName: props.targetKeyIdSsmParameterName,
        targetRegion: props.targetRegion,
      }
    );
  }
}
