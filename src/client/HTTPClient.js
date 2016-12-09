import Call from './Call';
import {EventEmitter} from 'events';

function HTTPClient(baseUrl, opts) {
  opts = Object.assign({}, HTTPClient.defaults, opts || {});
  if (!baseUrl.substring(baseUrl.length - 1) !== '/') {
    baseUrl += '/';
  }

  function doPost(url, body) {
    let params = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    };
    if (opts.headers) {
      Object.assign(params.headers, opts.headers);
    }
    if (opts.credentials) {
      params.credentials = opts.credentials;
    }
    client.emit('request', url, body, params);
    return fetch(url, params)
        .then(checkStatus)
        .then(resp => {
          client.emit('response', resp, url, body, params);
          return resp.json();
        });
  }

  function checkStatus(response) {
    if (response.status >= 200 && response.status < 300) {
      return response;
    } else {
      let error = new Error(response.statusText);
      error.response = response;
      throw error;
    }
  }

  function sendCall(service, method, params, isNotification) {
    let call = new Call(method, params, isNotification);
    let url = baseUrl;
    if (service) {
      if (opts.mode === 'methodPrefix') {
        call.method = service + '.' + call.method;
      } else {
        url += service || '';
      }
    }
    let p = doPost(url, call);
    if (call.id) {
      return p;
    } else {
      return Promise.resolve();
    }
  }

  let client = Object.assign(new EventEmitter(), {
    call(service, method, params) {
      return sendCall(service, method, params, false);
    },

    notify(service, method, params) {
      return sendCall(service, method, params, true);
    }
  });
  return client;
}

HTTPClient.defaults = {
  headers: {},
  mode: 'urlSuffix',
  credentials: 'same-origin'
};

export default HTTPClient;
