import { RpcBadRequestException } from '../base';

export class BranchNotActiveException extends RpcBadRequestException {
  constructor(objectOrError?: string | object, description = 'Branch is not active.') {
    super(objectOrError, description);
  }
}
