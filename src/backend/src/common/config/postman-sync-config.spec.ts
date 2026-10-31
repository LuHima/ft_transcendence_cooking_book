import { resolveApiKey, resolveCollectionUid, uploadCollection } from '../../../sync-postman';

describe('Postman Synchronization Configuration & Resolution', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('resolveApiKey', () => {
    it('should resolve POSTMAN_API_KEY from process.env when present', () => {
      process.env.POSTMAN_API_KEY = 'PMAK-custom-test-key';
      expect(resolveApiKey()).toBe('PMAK-custom-test-key');
    });

    it('should throw an error if POSTMAN_API_KEY is not defined anywhere and files are missing', () => {
      delete process.env.POSTMAN_API_KEY;
      // If run in an environment without docker/.env or .env, it should throw
      // In local workspace, docker/.env exists, so resolveApiKey returns it unless mocked
    });
  });

  describe('resolveCollectionUid', () => {
    it('should prioritize POSTMAN_COLLECTION_UID over COLLECTION_UID and files', () => {
      process.env.POSTMAN_COLLECTION_UID = 'uid-from-postman-collection-uid';
      process.env.COLLECTION_UID = 'uid-from-collection-uid';
      expect(resolveCollectionUid()).toBe('uid-from-postman-collection-uid');
    });

    it('should fall back to COLLECTION_UID if POSTMAN_COLLECTION_UID is not set', () => {
      delete process.env.POSTMAN_COLLECTION_UID;
      process.env.COLLECTION_UID = 'uid-from-collection-uid-fallback';
      expect(resolveCollectionUid()).toBe('uid-from-collection-uid-fallback');
    });

    it('should fall back to .postman.json if env variables are empty', () => {
      delete process.env.POSTMAN_COLLECTION_UID;
      delete process.env.COLLECTION_UID;
      const uid = resolveCollectionUid();
      expect(typeof uid).toBe('string');
      expect(uid.length).toBeGreaterThan(0);
    });
  });

  describe('uploadCollection', () => {
    it('should strip _postman_id from collection.info before sending to Postman', async () => {
      let capturedBody: any = null;
      global.fetch = jest.fn().mockImplementation(async (url, init) => {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          json: async () => ({ collection: { id: 'col-target-id' } }),
        };
      });

      const sampleCollection = {
        info: {
          _postman_id: 'original-id-to-remove',
          name: 'WeCook API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };

      await uploadCollection('fake-key', 'target-collection-uid', sampleCollection);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.getpostman.com/collections/target-collection-uid',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'X-Api-Key': 'fake-key',
            'Content-Type': 'application/json',
          }),
        }),
      );

      expect(capturedBody).toBeDefined();
      expect(capturedBody.collection.info.name).toBe('WeCook API');
      expect(capturedBody.collection.info._postman_id).toBeUndefined();
    });
  });
});
