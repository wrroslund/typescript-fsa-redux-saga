import {AsyncActionCreators} from "typescript-fsa" ;
import { SagaIterator, delay } from "redux-saga";
import {put, call, cancelled} from "redux-saga/effects";


function* callWithRetries(
  options: BindAsyncActionOptions = {}, 
  worker: (params: any, ...args: any[]) => Promise<any> | SagaIterator, 
  params: any, 
  ...args: any[]) {
  const retryCount = options.retryCount || 1;
  for (let i = 0; i < retryCount; i++) {
    try {
      const apiResponse = yield (call as any)(worker, params, ...args);
      return apiResponse;
    } catch (err) {
      if (i < retryCount - 1) {
        yield call(delay, 2000);
      } else {
        console.error(`call failed after ${retryCount} retries`);
        throw err;
      }
      
    }
  }
}

export interface BindAsyncActionOptions {
  skipStartedAction?: boolean;
  retryCount?: number;
}

export function bindAsyncAction<R>(
  actionCreators: AsyncActionCreators<void, R, any>,
  options?: BindAsyncActionOptions,
): {
  (worker: () => Promise<R> | SagaIterator): () => SagaIterator;

  (worker: (params: void) => Promise<R> | SagaIterator):
    (params: void) => SagaIterator;

  <A1>(worker: (params: void, arg1: A1) => Promise<R> | SagaIterator):
    (params: void, arg1: A1) => SagaIterator;

  <A1, A2>(worker: (params: void, arg1: A1,
                    arg2: A2) => Promise<R> | SagaIterator):
    (params: void, arg1: A1, arg2: A2) => SagaIterator;

  <A1, A2, A3>(worker: (params: void, arg1: A1, arg2: A2, arg3: A3,
                        ...rest: any[]) => Promise<R> | SagaIterator):
    (params: void, arg1: A1, arg2: A2, arg3: A3,
     ...rest: any[]) => SagaIterator;
};
export function bindAsyncAction<P, R>(
  actionCreators: AsyncActionCreators<P, R, any>,
  options?: BindAsyncActionOptions,
): {
  (worker: (params: P) => Promise<R> | SagaIterator):
    (params: P) => SagaIterator;

  <A1>(worker: (params: P, arg1: A1) => Promise<R> | SagaIterator):
    (params: P, arg1: A1) => SagaIterator;

  <A1, A2>(worker: (params: P, arg1: A1,
                    arg2: A2) => Promise<R> | SagaIterator):
    (params: P, arg1: A1, arg2: A2) => SagaIterator;

  <A1, A2, A3>(worker: (params: P, arg1: A1, arg2: A2, arg3: A3,
                        ...rest: any[]) => Promise<R> | SagaIterator):
    (params: P, arg1: A1, arg2: A2, arg3: A3, ...rest: any[]) => SagaIterator;
};

export function bindAsyncAction(
  actionCreator: AsyncActionCreators<any, any, any>,
  options: BindAsyncActionOptions = {},
) {
  return (worker: (params: any, ...args: any[]) => Promise<any> | SagaIterator) => {
    function* boundAsyncActionSaga(params: any, ...args: any[]): SagaIterator {
      if (!options.skipStartedAction) {
        yield put(actionCreator.started(params));
      }

      try {
        let result = null;
        if (options.retryCount && !isNaN(options.retryCount)) {
          result  = yield (call as any)(
            callWithRetries, 
            options, 
            worker, 
            params, 
            ...args);
        } else {
          result  = yield (call as any)(worker, params, ...args);
        }
        yield put(actionCreator.done({params, result}));
        return result;
      } catch (error) {
        yield put(actionCreator.failed({params, error}));
        throw error;
      } finally {
        if (yield cancelled()) {
          yield put(actionCreator.failed({params, error: 'cancelled'}));
        }
      }
    }

    const capName = worker.name.charAt(0).toUpperCase() +
                    worker.name.substring(1);

    return setFunctionName(
      boundAsyncActionSaga,
      `bound${capName}(${actionCreator.type})`,
    );
  };
}


/**
 * Set function name.
 *
 * Note that this won't have effect on built-in Chrome stack traces, although
 * useful for stack traces generated by `redux-saga`.
 */
function setFunctionName<F extends Function>(func: F,
                                             name: string): F {
  try {
    Object.defineProperty(func, 'name', {
      value: name,
      configurable: true,
    });
  } catch (e) {
    // ignore
  }

  return func;
}
