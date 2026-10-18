// Abstract image storage provider.
// LocalStorageProvider (default) writes to disk.
// Future: S3StorageProvider follows the same interface.

export interface UploadResult {
  thumbPath: string;   // relative path stored in DB  e.g. "products/tenant-id/prod-id-thumb.webp"
  detailPath: string;
  thumbUrl: string;    // public URL served to the client
  detailUrl: string;
}

export interface StorageProvider {
  name: 'local' | 's3';

  saveProductImage(
    tenantId: string,
    productId: string,
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<UploadResult>;

  deleteProductImage(
    thumbPath: string,
    detailPath: string,
  ): Promise<void>;
}
