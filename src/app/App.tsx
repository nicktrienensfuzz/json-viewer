import React, { useCallback, useEffect, useRef, useState} from 'react';
import Split from '@uiw/react-split';
import JsonViewer from 'react-json-view';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { json as jsonLang } from '@codemirror/lang-json';
import { createHashHistory } from 'history';
import styles from './App.module.css';
// import useWebSocket, { ReadyState } from 'react-use-websocket';
import WebSocket from 'isomorphic-ws';

type Parameters = {
  json?: string;
  cornerhref?: string;
  hidenheader?: '1' | '0';
  corner?: '1' | '0';
  view?: 'preview'| 'editor';
  room?: string;
}
const history = createHashHistory();
const getURLParameters = (url: string): Parameters =>
  (url.match(/([^?=&]+)(=([^&]*))/g) || []).reduce(
    (a: any, v) => (
      ((a[v.slice(0, v.indexOf('='))] = v.slice(v.indexOf('=') + 1)), a)
    ),
    {}
  );
const objectToQueryString = (queryParameters: Parameters) => {
  return queryParameters
    ? Object.entries(queryParameters).reduce(
        (queryString, [key, val], index) => {
          const symbol = queryString.length === 0 ? '?' : '&';
          queryString +=
            typeof val === 'string' ? `${symbol}${key}=${val}` : '';
          return queryString;
        },
        ''
      )
    : '';
};

const connection =new WebSocket('wss://4z49eakjsl.execute-api.us-west-2.amazonaws.com/dev')
const App = () => {
  const param = getURLParameters(window.location.href);
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  param.json = param.json ? decodeURI(param.json): undefined;
  const [code, setCode] = React.useState(decodeURIComponent(param.json || ''));
  const [room] = React.useState(param.room || 'default');
  const [json, setJson] = React.useState();
  const [message, setMessage] = React.useState('');
  const [linebar, setLinebar] = React.useState('');
  const [suppressWebSocketSend, setSuppressWebSocketSend] = React.useState(false);
  
  const [connectionState, setConnectionState] = React.useState('');
  const [connectionId, setConnectionId] = React.useState('');
  //const [socketUrl] = useState('wss://4z49eakjsl.execute-api.us-west-2.amazonaws.com/dev');
  
  const [ws] = useState<WebSocket>(connection);

  useEffect(() => {
    // let wslocal = new WebSocket(socketUrl);
    // setWS(wslocal)
    let wslocal = ws
    wslocal.onopen = function open() {
      console.log('connected');
      setConnectionState("open")
    };
    
    wslocal.onclose = function close() {
      console.log('disconnected');
      setConnectionState("closed")
    };
    wslocal.onmessage = function message(data) {
      let messageBody: string = data.data.toString()
      console.log('received: ', messageBody);

      if (messageBody) {
        let jsonBody = JSON.parse(messageBody);
        console.log("JSON Message: ", jsonBody);
        if (jsonBody.connectionId) {
          console.log(" connectionID ", jsonBody.connectionId);
          setConnectionId(jsonBody.connectionId)
        } else if (jsonBody.from &&  jsonBody.from === connectionId) {
          console.log("Skip processing", jsonBody.connectionId);
    
          return
        }
        let sentJson =  decodeURIComponent(JSON.parse(messageBody).body || "" );
        console.log("body: " +  sentJson);
    
      try {
        //const obj = JSON.parse(code);
        console.log("body: " +  sentJson);
        if (sentJson.length > 3) {
          setSuppressWebSocketSend(true)
          setCode(sentJson);
          setSuppressWebSocketSend(false)
        }
      } catch (error) {
          if (error instanceof Error) {
            console.log("Error: " +  error);
            
            // setJson(undefined)
          } else {
            throw error;
          }
        }
      }

    };
  });

  const formatJson = useCallback((_, replacer: number = 2) => {
    setMessage('');
    try {
      if (code) {
        const obj = JSON.parse(code);
        const str = JSON.stringify(obj, null, replacer);
        setCode(str);
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
        setJson(undefined)
      } else {
        throw error;
      }
    }
  }, []);

  const shareJson = () => {
    param.json = encodeURI(code);
    history.push(`${objectToQueryString(param)}`, { some: "state" });
  }

  // editor updated
  useEffect(() => {
    console.log("json: " +  code);
    setMessage('');
    try {
      if (code) {
        const obj = JSON.parse(code);
        if (!suppressWebSocketSend) {
          if (ws) {  
            console.log("sending: " +  code); 
            ws.send( encodeURI(code))
          }
          
        }
        setJson(obj);
      }
    } catch (error) {
      if (error instanceof Error) {
        setMessage(error.message);
        setJson(undefined)
      } else {
        throw error;
      }
    }
  }, [code]);


  const editor = (
    <div style={{ minWidth: 230, width: param.view === 'editor' ? '100%' : '45%', position: 'relative', backgroundColor: 'rgb(245, 245, 245)' }}>
      <div style={{overflow: 'auto',height: '100%', boxSizing: 'border-box' }}>
        <CodeMirror
          value={code}
          ref={cmRef}
          height="100%"
          style={{ height: '100%' }}
          extensions={[jsonLang()]}
          onUpdate={(cm) => {
            if (param.hidenheader === '1') {
              return;
            }
            const { selection } = cm.state;
            const line = cm.view.state.doc.lineAt(selection.main.from);
            setLinebar(`Line ${line.number}/${cm.state.doc.lines}, Column ${cm.state.selection.main.head - line.from + 1}`);
            const text = cm.state.sliceDoc(selection.main.from, selection.main.to);
            if (text) {
              if (selection.ranges.length > 1) {
                setLinebar(`${selection.ranges.length} selection regions`);
              } else {
                setLinebar(`${text.split('\n').length} lines, ${text.length} characters selected`);
              }
            }
          }}
          onChange={(value, viewUpdate) => {
            setCode(value)
          }}
        />
      </div>
    </div>
  );

  const preview = (
    <div style={{ flex: 1, minWidth: 230, userSelect: 'none', padding: 10, overflow: 'auto' }}>
      {message && (
        <pre style={{ padding: 0, margin: 0, color: 'red' }}>
          {message}
        </pre>
      )}
      {json && typeof json == 'object' && (
        <JsonViewer src={json!} theme="rjv-default" style={{  }} displayDataTypes={false} />
      )}
    </div>
  );
  return (
    <div className={styles.app}>
      <Split mode="vertical" visiable={false}>
        {param.hidenheader !== '1' && (
          <div className={styles.header} style={{  }}>
            <h1>JSON Viewer</h1>
            <div className={styles.toolbar}>
              <div>
                {linebar && (
                  <span> {linebar} </span>
                )}
              </div>
              {message && (
                <div className={styles.message}>{message}</div>
              )}
              <div className={styles.btn}>
                <button onClick={formatJson}>
                  Format
                </button>
                <button onClick={() => formatJson(null, 0)}>
                  Compress
                </button>
                {code && (
                  <button onClick={() => shareJson()}>
                    Share
                  </button>
                )}
                {/* websocket testing */}
                <span>The WebSocket is currently {connectionState } in {room}</span>
              </div>
            </div>
          </div>
        )}
        <Split style={{ flex: 1, height: param.hidenheader !== '1' ? 'calc(100% - 32px)' : '100%' }}>
          {!param.view && editor}
          {!param.view && preview}
          {param.view === 'editor' && editor}
          {param.view === 'preview' && preview}
        </Split>
      </Split>
    </div>
  )
};

export default App;
