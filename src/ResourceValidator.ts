export class MD5Validator {
    public static async validate(arrayBuffer: ArrayBuffer, expectedMD5: string): Promise<boolean> {
        try {
            const hashBuffer = await this.computeHash(arrayBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            return hashHex.toLowerCase() === expectedMD5.toLowerCase();
        } catch (error) {
            console.error('MD5 validation failed:', error);
            return false;
        }
    }

    public static async computeHash(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
        const webCrypto = (typeof globalThis !== 'undefined' && (globalThis as any).crypto) ||
                         (typeof window !== 'undefined' && window.crypto) ||
                         (typeof global !== 'undefined' && (global as any).crypto);

        if (webCrypto && webCrypto.subtle) {
            const hashBuffer = await webCrypto.subtle.digest('SHA-256', arrayBuffer);
            return hashBuffer;
        }

        try {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256');
            hash.update(Buffer.from(arrayBuffer));
            return hash.digest().buffer;
        } catch (error) {
            throw new Error('Crypto API is not available');
        }
    }

    public static async computeMD5(arrayBuffer: ArrayBuffer): Promise<string> {
        const hashBuffer = await this.computeHash(arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public static async validateFile(file: File, expectedMD5: string): Promise<boolean> {
        const arrayBuffer = await file.arrayBuffer();
        return this.validate(arrayBuffer, expectedMD5);
    }
}

export class DataIntegrityChecker {
    public static async computeChecksum(data: ArrayBuffer): Promise<string> {
        const hashBuffer = await MD5Validator.computeHash(data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public static async verifyChunk(
        chunk: ArrayBuffer, 
        expectedChecksum: string
    ): Promise<boolean> {
        const hashBuffer = await MD5Validator.computeHash(chunk);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return checksum === expectedChecksum;
    }

    public static isValidResourceData(data: ArrayBuffer, expectedSize: number): boolean {
        return data.byteLength === expectedSize && data.byteLength > 0;
    }
}