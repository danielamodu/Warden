import type { IEscrowService } from './IEscrowService';
import { MockEscrowService } from './MockEscrowService';
import { RealEscrowService } from './RealEscrowService';

const useMock = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const escrowService: IEscrowService = useMock ? new MockEscrowService() : new RealEscrowService();

export type { IEscrowService } from './IEscrowService';
