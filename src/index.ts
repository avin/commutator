import mitt, { Emitter } from 'mitt';

type CommutatorOptions = {
  serviceId: string;
  target: Window;
  origin?: string;
};

type ReqMessageObject = {
  type: 'req';
  funcName: string;
  params: any;
  id: string;
};

type ResMessageObject = {
  type: 'res';
  result: any;
  error: any;
  id: string;
};

export class Commutator {
  options!: CommutatorOptions;

  private exposeListenersMap: Record<string, [(p:any) => any,(p:any) => any][]> = {};

  private emitter!: Emitter<any>;

  constructor(options: CommutatorOptions) {
    this.options = options;
    this.emitter = mitt();

    window.addEventListener('message', this.handleMessage, false);
  }

  destroy() {
    window.removeEventListener('message', this.handleMessage, false);
    this.emitter.all.clear();
  }

  private handleMessage = (event: MessageEvent) => {
    let data: string = event.data;
    if (data?.startsWith && data?.startsWith(`${this.options.serviceId}::`)) {
      data = data.replace(`${this.options.serviceId}::`, '');
      const dataObj = JSON.parse(data) as ReqMessageObject | ResMessageObject;

      if (dataObj.type === 'res') {
        this.emitter.emit(`res_${dataObj.id}`, dataObj);
      } else if (dataObj.type === 'req') {
        this.emitter.emit(`req_${dataObj.funcName}`, dataObj);
      }
    }
  }

  call<T>(funcName: string, params: any): Promise<T> {
    const messageId = Commutator.makeId();
    const formattedMessage = `${this.options.serviceId}::${JSON.stringify({
      funcName,
      params,
      id: messageId,
      type: 'req',
    })}`;

    this.options.target.postMessage(formattedMessage, this.options.origin || '*');

    return new Promise((resolve, reject) => {
      this.emitter.on(`res_${messageId}`, (dataObj: ResMessageObject) => {
        this.emitter.off(`res_${messageId}`);
        if (dataObj.error) {
          const err = new Error();
          for (const key of Object.keys(dataObj.error)) {
            err[key] = dataObj.error[key];
          }
          return reject(err);
        }
        return resolve(dataObj.result as T);
      });
    });
  }

  expose(funcName: string, cb: (params: any) => any) {
    const handler = (dataObj: ReqMessageObject) => {
      void (async () => {
        const { result, error } = await (async () => {
          try {
            const result = await cb(dataObj.params);
            return { result, error: null };
          } catch (err) {
            const errObj = JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err)));
            return { result: null, error: errObj };
          }
        })();

        const formattedMessage = `${this.options.serviceId}::${JSON.stringify({
          result,
          error,
          id: dataObj.id,
          type: 'res',
        })}`;

        this.options.target.postMessage(formattedMessage, this.options.origin || '*');
      })();
    }
    const key = `req_${funcName}`;
    this.emitter.on(key, handler);
    this.exposeListenersMap[key] ||= []
    this.exposeListenersMap[key].push([cb, handler])
  }

  unexpose(funcName: string, cb: (params: any) => any) {
    const key = `req_${funcName}`;
    const exposeListeners =  this.exposeListenersMap[key] || []
    const item = exposeListeners.find(i => i[0] === cb);
    if(item){
      this.emitter.off(key, item[1]);
    }
  }

  static makeId(length = 10) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i += 1) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }
}
