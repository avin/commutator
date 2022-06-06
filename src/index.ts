import mitt, { Emitter } from 'mitt';

type CommutatorOptions = {
    serviceId: string;
    target: Window;
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
    id: string;
};

export class Commutator {
    options!: CommutatorOptions;

    private emitter!: Emitter<any>;

    constructor(options: CommutatorOptions) {
        this.options = options;
        this.emitter = mitt();

        window.addEventListener('message', this.handleMessage.bind(this), false);
    }

    private handleMessage(event: MessageEvent) {
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

        this.options.target.postMessage(formattedMessage);

        return new Promise((resolve, reject) => {
            this.emitter.on(`res_${messageId}`, (dataObj: ResMessageObject) => {
                this.emitter.off(`res_${messageId}`);
                return resolve(dataObj.result as T);
            });
        });
    }

    expose(funcName: string, cb: (params: any) => any) {
        this.emitter.on(`req_${funcName}`, (dataObj: ReqMessageObject) => {
            void (async () => {
                const result = await cb(dataObj.params);

                const formattedMessage = `${this.options.serviceId}::${JSON.stringify({
                    result,
                    id: dataObj.id,
                    type: 'res',
                })}`;

                this.options.target.postMessage(formattedMessage);
            })();
        });
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
