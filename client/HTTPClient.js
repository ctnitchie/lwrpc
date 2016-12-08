import Call from './Call';
import {EventEmitter} from 'events';

function HTTPClient(baseUrl) {

  function doPost(url, body) {
    let params = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    };
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
    let url = baseUrl + (service || '');
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

export default HTTPClient;
