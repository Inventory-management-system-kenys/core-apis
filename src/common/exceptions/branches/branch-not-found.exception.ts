import { RpcNotFoundException } from '../base';

export class BranchNotFoundException extends RpcNotFoundException {
  constructor(objectOrError?: string | object, description = 'Branch not found.') {
    super(objectOrError, description);
  }
}
