import fs from 'node:fs';
import path from 'node:path';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { DEFAULT_BACKUP_RETENTION_DAYS } from './dbBackup';

export type R2OffsiteConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  prefix: string;
};

/** Read R2 settings from env-like object. Returns null if offsite is not fully configured. */
export const resolveR2OffsiteConfig = (
  env: Record<string, string | undefined> = process.env
): R2OffsiteConfig | null => {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const rawPrefix = env.R2_PREFIX?.trim() ?? '';
  const prefix = rawPrefix && !rawPrefix.endsWith('/') ? `${rawPrefix}/` : rawPrefix;
  return { accountId, accessKeyId, secretAccessKey, bucket, prefix };
};

export const offsiteObjectKey = (fileName: string, prefix: string): string => {
  const clean = prefix.replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/${fileName}` : fileName;
};

export type R2OffsiteDeps = {
  putObject: (args: {
    bucket: string;
    key: string;
    body: Buffer;
    contentType: string;
  }) => Promise<void>;
  listObjects: (args: { bucket: string; prefix: string }) => Promise<Array<{ key: string; lastModified: Date }>>;
  deleteObjects: (args: { bucket: string; keys: string[] }) => Promise<void>;
};

const createS3Client = (cfg: R2OffsiteConfig): S3Client =>
  new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey
    }
  });

const defaultDeps = (cfg: R2OffsiteConfig): R2OffsiteDeps => {
  const client = createS3Client(cfg);
  return {
    putObject: async ({ bucket, key, body, contentType }) => {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      }));
    },
    listObjects: async ({ bucket, prefix }) => {
      const out: Array<{ key: string; lastModified: Date }> = [];
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix || undefined,
          ContinuationToken: token
        }));
        for (const obj of page.Contents ?? []) {
          if (!obj.Key || !obj.LastModified) continue;
          out.push({ key: obj.Key, lastModified: obj.LastModified });
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return out;
    },
    deleteObjects: async ({ bucket, keys }) => {
      if (keys.length === 0) return;
      await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) }
      }));
    }
  };
};

export type OffsiteUploadResult = { key: string; pruned: string[] };

/** Upload a local backup file to R2 and prune older objects under the same prefix. */
export const createR2OffsiteUploader = (
  cfg: R2OffsiteConfig,
  deps: R2OffsiteDeps = defaultDeps(cfg)
): ((localPath: string, opts?: { retentionDays?: number }) => Promise<OffsiteUploadResult>) => {
  return async (localPath, opts = {}) => {
    const retentionDays = opts.retentionDays ?? DEFAULT_BACKUP_RETENTION_DAYS;
    const key = offsiteObjectKey(path.basename(localPath), cfg.prefix);
    const body = fs.readFileSync(localPath);
    await deps.putObject({
      bucket: cfg.bucket,
      key,
      body,
      contentType: 'application/octet-stream'
    });

    const listed = await deps.listObjects({ bucket: cfg.bucket, prefix: cfg.prefix });
    const serverFiles = listed
      .filter((o) => /(^|\/)server-.*\.db$/i.test(o.key))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    const toDelete = serverFiles.slice(Math.max(0, retentionDays)).map((o) => o.key);
    if (toDelete.length > 0) {
      await deps.deleteObjects({ bucket: cfg.bucket, keys: toDelete });
    }
    return { key, pruned: toDelete };
  };
};
