class Caller {

    constructor(transport) {
        this._requestId = 0;
        this._transport = transport;
    }

    execute(method, ...params) {
        return new Promise((resolve, reject) => {
            const id = ++this._requestId;
            const listener = msg => {
                if (!msg.id) {
                    reject(msg);
                } else if (msg.id == id) {
                    if (msg.error)
                        reject(msg.error)
                    else
                        resolve(msg.result);
                    this._transport.incoming.off('message', listener);
                }
            }
            this._transport.incoming.on('message', listener);
            this._transport.send({
                'jsonrpc': '2.0',
                'id': id,
                'method': method,
                'params': params,
            });
            this._transport.incoming.once('close',
                () => this._transport.incoming.off('publish', listener));
        });
    }

    async subscribe(cb, method, ...params) {
        // Send subscribe request
        let subId = await this.execute('subscribe', method, ...params);
        if (typeof subId !== 'string')
            throw new Error("Got no subscription ID");

        // Listen for incoming requests
        const listener = (incomingSubId, result) => {
            if (subId != incomingSubId)
                return;
            cb(result);
        }
        this._transport.incoming.on('publish', listener);
        this._transport.incoming.once('close', incomingSubId => {
            if (subId != incomingSubId)
                return;
            this._transport.incoming.off('publish', listener);
        });

        return {
            id: subId,
            close: async () => {
                this._transport.incoming.off('publish', listener);
                await this.execute('unsubscribe', subId);
            }
        };
    }

}

module.exports = Caller;