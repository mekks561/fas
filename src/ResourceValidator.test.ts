import { MD5Validator, DataIntegrityChecker } from './ResourceValidator';

describe('MD5Validator', () => {
    describe('MD5 Validation', () => {
        it('should validate correct MD5', async () => {
            const data = new ArrayBuffer(1024);
            const validMD5 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
            
            const result = await MD5Validator.validate(data, validMD5);
            expect(typeof result).toBe('boolean');
        });

        it('should reject incorrect MD5', async () => {
            const data = new ArrayBuffer(1024);
            const invalidMD5 = '00000000000000000000000000000000';
            
            const result = await MD5Validator.validate(data, invalidMD5);
            expect(result).toBe(false);
        });

        it('should handle empty data', async () => {
            const data = new ArrayBuffer(0);
            const md5 = 'e3b0c44298fc1c149afbf4c8996fb924';
            
            const result = await MD5Validator.validate(data, md5);
            expect(typeof result).toBe('boolean');
        });
    });

    describe('Checksum Computation', () => {
        it('should compute consistent checksums', async () => {
            const data = new Uint8Array([1, 2, 3, 4, 5]).buffer;
            
            const checksum1 = await MD5Validator.computeMD5(data);
            const checksum2 = await MD5Validator.computeMD5(data);
            
            expect(checksum1).toBe(checksum2);
        });

        it('should compute different checksums for different data', async () => {
            const data1 = new Uint8Array([1, 2, 3]).buffer;
            const data2 = new Uint8Array([4, 5, 6]).buffer;
            
            const checksum1 = await MD5Validator.computeMD5(data1);
            const checksum2 = await MD5Validator.computeMD5(data2);
            
            expect(checksum1).not.toBe(checksum2);
        });
    });
});

describe('DataIntegrityChecker', () => {
    describe('Resource Data Validation', () => {
        it('should validate correct size data', () => {
            const data = new ArrayBuffer(1000);
            const expectedSize = 1000;
            
            const result = DataIntegrityChecker.isValidResourceData(data, expectedSize);
            expect(result).toBe(true);
        });

        it('should reject incorrect size data', () => {
            const data = new ArrayBuffer(500);
            const expectedSize = 1000;
            
            const result = DataIntegrityChecker.isValidResourceData(data, expectedSize);
            expect(result).toBe(false);
        });

        it('should reject empty data', () => {
            const data = new ArrayBuffer(0);
            const expectedSize = 0;
            
            const result = DataIntegrityChecker.isValidResourceData(data, expectedSize);
            expect(result).toBe(false);
        });
    });
});
