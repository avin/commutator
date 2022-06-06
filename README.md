# Commutator

Making RPC calls (asynchronous method calls) between browser windows or iframes.

## Install
```
npm install commutator
```

## Usage

**parent.js**

```js
import { Commutator } from 'commutator';

const rpc = new Commutator({
// The window you want to talk to:
target: myIframe.contentWindow,
// This should be unique for each of your producer<->consumer pairs:
serviceId: 'my-awesome-service',
});

rpc.expose('add', (data) => data.a + data.b);
```

**iframe.js**

```js
import { Commutator } from 'commutator';

const rpc = new Commutator({
target: window.parent,
serviceId: 'my-awesome-service',
});

rpc.call('add', { a: 3, b: 5 }).then(result => console.log('3 + 5 is', result));
```

