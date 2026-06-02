var m;(function(t){t.STRING="string",t.NUMBER="number",t.INTEGER="integer",t.BOOLEAN="boolean",t.ARRAY="array",t.OBJECT="object"})(m||(m={}));/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var w;(function(t){t.LANGUAGE_UNSPECIFIED="language_unspecified",t.PYTHON="python"})(w||(w={}));var b;(function(t){t.OUTCOME_UNSPECIFIED="outcome_unspecified",t.OUTCOME_OK="outcome_ok",t.OUTCOME_FAILED="outcome_failed",t.OUTCOME_DEADLINE_EXCEEDED="outcome_deadline_exceeded"})(b||(b={}));/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const M=["user","model","function","system"];var L;(function(t){t.HARM_CATEGORY_UNSPECIFIED="HARM_CATEGORY_UNSPECIFIED",t.HARM_CATEGORY_HATE_SPEECH="HARM_CATEGORY_HATE_SPEECH",t.HARM_CATEGORY_SEXUALLY_EXPLICIT="HARM_CATEGORY_SEXUALLY_EXPLICIT",t.HARM_CATEGORY_HARASSMENT="HARM_CATEGORY_HARASSMENT",t.HARM_CATEGORY_DANGEROUS_CONTENT="HARM_CATEGORY_DANGEROUS_CONTENT"})(L||(L={}));var D;(function(t){t.HARM_BLOCK_THRESHOLD_UNSPECIFIED="HARM_BLOCK_THRESHOLD_UNSPECIFIED",t.BLOCK_LOW_AND_ABOVE="BLOCK_LOW_AND_ABOVE",t.BLOCK_MEDIUM_AND_ABOVE="BLOCK_MEDIUM_AND_ABOVE",t.BLOCK_ONLY_HIGH="BLOCK_ONLY_HIGH",t.BLOCK_NONE="BLOCK_NONE"})(D||(D={}));var G;(function(t){t.HARM_PROBABILITY_UNSPECIFIED="HARM_PROBABILITY_UNSPECIFIED",t.NEGLIGIBLE="NEGLIGIBLE",t.LOW="LOW",t.MEDIUM="MEDIUM",t.HIGH="HIGH"})(G||(G={}));var x;(function(t){t.BLOCKED_REASON_UNSPECIFIED="BLOCKED_REASON_UNSPECIFIED",t.SAFETY="SAFETY",t.OTHER="OTHER"})(x||(x={}));var R;(function(t){t.FINISH_REASON_UNSPECIFIED="FINISH_REASON_UNSPECIFIED",t.STOP="STOP",t.MAX_TOKENS="MAX_TOKENS",t.SAFETY="SAFETY",t.RECITATION="RECITATION",t.LANGUAGE="LANGUAGE",t.BLOCKLIST="BLOCKLIST",t.PROHIBITED_CONTENT="PROHIBITED_CONTENT",t.SPII="SPII",t.MALFORMED_FUNCTION_CALL="MALFORMED_FUNCTION_CALL",t.OTHER="OTHER"})(R||(R={}));var U;(function(t){t.TASK_TYPE_UNSPECIFIED="TASK_TYPE_UNSPECIFIED",t.RETRIEVAL_QUERY="RETRIEVAL_QUERY",t.RETRIEVAL_DOCUMENT="RETRIEVAL_DOCUMENT",t.SEMANTIC_SIMILARITY="SEMANTIC_SIMILARITY",t.CLASSIFICATION="CLASSIFICATION",t.CLUSTERING="CLUSTERING"})(U||(U={}));var H;(function(t){t.MODE_UNSPECIFIED="MODE_UNSPECIFIED",t.AUTO="AUTO",t.ANY="ANY",t.NONE="NONE"})(H||(H={}));var F;(function(t){t.MODE_UNSPECIFIED="MODE_UNSPECIFIED",t.MODE_DYNAMIC="MODE_DYNAMIC"})(F||(F={}));/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class u extends Error{constructor(e){super(`[GoogleGenerativeAI Error]: ${e}`)}}class I extends u{constructor(e,n){super(e),this.response=n}}class q extends u{constructor(e,n,s,o){super(e),this.status=n,this.statusText=s,this.errorDetails=o}}class C extends u{}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const W="https://generativelanguage.googleapis.com",X="v1beta",Q="0.22.0",z="genai-js";var _;(function(t){t.GENERATE_CONTENT="generateContent",t.STREAM_GENERATE_CONTENT="streamGenerateContent",t.COUNT_TOKENS="countTokens",t.EMBED_CONTENT="embedContent",t.BATCH_EMBED_CONTENTS="batchEmbedContents"})(_||(_={}));class Z{constructor(e,n,s,o,i){this.model=e,this.task=n,this.apiKey=s,this.stream=o,this.requestOptions=i}toString(){var e,n;const s=((e=this.requestOptions)===null||e===void 0?void 0:e.apiVersion)||X;let i=`${((n=this.requestOptions)===null||n===void 0?void 0:n.baseUrl)||W}/${s}/${this.model}:${this.task}`;return this.stream&&(i+="?alt=sse"),i}}function tt(t){const e=[];return t!=null&&t.apiClient&&e.push(t.apiClient),e.push(`${z}/${Q}`),e.join(" ")}async function et(t){var e;const n=new Headers;n.append("Content-Type","application/json"),n.append("x-goog-api-client",tt(t.requestOptions)),n.append("x-goog-api-key",t.apiKey);let s=(e=t.requestOptions)===null||e===void 0?void 0:e.customHeaders;if(s){if(!(s instanceof Headers))try{s=new Headers(s)}catch(o){throw new C(`unable to convert customHeaders value ${JSON.stringify(s)} to Headers: ${o.message}`)}for(const[o,i]of s.entries()){if(o==="x-goog-api-key")throw new C(`Cannot set reserved header name ${o}`);if(o==="x-goog-api-client")throw new C(`Header name ${o} can only be set using the apiClient field`);n.append(o,i)}}return n}async function nt(t,e,n,s,o,i){const a=new Z(t,e,n,s,i);return{url:a.toString(),fetchOptions:Object.assign(Object.assign({},at(i)),{method:"POST",headers:await et(a),body:o})}}async function A(t,e,n,s,o,i={},a=fetch){const{url:r,fetchOptions:d}=await nt(t,e,n,s,o,i);return st(r,d,a)}async function st(t,e,n=fetch){let s;try{s=await n(t,e)}catch(o){ot(o,t)}return s.ok||await it(s,t),s}function ot(t,e){let n=t;throw t instanceof q||t instanceof C||(n=new u(`Error fetching from ${e.toString()}: ${t.message}`),n.stack=t.stack),n}async function it(t,e){let n="",s;try{const o=await t.json();n=o.error.message,o.error.details&&(n+=` ${JSON.stringify(o.error.details)}`,s=o.error.details)}catch{}throw new q(`Error fetching from ${e.toString()}: [${t.status} ${t.statusText}] ${n}`,t.status,t.statusText,s)}function at(t){const e={};if((t==null?void 0:t.signal)!==void 0||(t==null?void 0:t.timeout)>=0){const n=new AbortController;(t==null?void 0:t.timeout)>=0&&setTimeout(()=>n.abort(),t.timeout),t!=null&&t.signal&&t.signal.addEventListener("abort",()=>{n.abort()}),e.signal=n.signal}return e}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function T(t){return t.text=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`),N(t.candidates[0]))throw new I(`${E(t)}`,t);return rt(t)}else if(t.promptFeedback)throw new I(`Text not available. ${E(t)}`,t);return""},t.functionCall=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`),N(t.candidates[0]))throw new I(`${E(t)}`,t);return console.warn("response.functionCall() is deprecated. Use response.functionCalls() instead."),$(t)[0]}else if(t.promptFeedback)throw new I(`Function call not available. ${E(t)}`,t)},t.functionCalls=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`),N(t.candidates[0]))throw new I(`${E(t)}`,t);return $(t)}else if(t.promptFeedback)throw new I(`Function call not available. ${E(t)}`,t)},t}function rt(t){var e,n,s,o;const i=[];if(!((n=(e=t.candidates)===null||e===void 0?void 0:e[0].content)===null||n===void 0)&&n.parts)for(const a of(o=(s=t.candidates)===null||s===void 0?void 0:s[0].content)===null||o===void 0?void 0:o.parts)a.text&&i.push(a.text),a.executableCode&&i.push("\n```"+a.executableCode.language+`
`+a.executableCode.code+"\n```\n"),a.codeExecutionResult&&i.push("\n```\n"+a.codeExecutionResult.output+"\n```\n");return i.length>0?i.join(""):""}function $(t){var e,n,s,o;const i=[];if(!((n=(e=t.candidates)===null||e===void 0?void 0:e[0].content)===null||n===void 0)&&n.parts)for(const a of(o=(s=t.candidates)===null||s===void 0?void 0:s[0].content)===null||o===void 0?void 0:o.parts)a.functionCall&&i.push(a.functionCall);if(i.length>0)return i}const ct=[R.RECITATION,R.SAFETY,R.LANGUAGE];function N(t){return!!t.finishReason&&ct.includes(t.finishReason)}function E(t){var e,n,s;let o="";if((!t.candidates||t.candidates.length===0)&&t.promptFeedback)o+="Response was blocked",!((e=t.promptFeedback)===null||e===void 0)&&e.blockReason&&(o+=` due to ${t.promptFeedback.blockReason}`),!((n=t.promptFeedback)===null||n===void 0)&&n.blockReasonMessage&&(o+=`: ${t.promptFeedback.blockReasonMessage}`);else if(!((s=t.candidates)===null||s===void 0)&&s[0]){const i=t.candidates[0];N(i)&&(o+=`Candidate was blocked due to ${i.finishReason}`,i.finishMessage&&(o+=`: ${i.finishMessage}`))}return o}function p(t){return this instanceof p?(this.v=t,this):new p(t)}function dt(t,e,n){if(!Symbol.asyncIterator)throw new TypeError("Symbol.asyncIterator is not defined.");var s=n.apply(t,e||[]),o,i=[];return o={},a("next"),a("throw"),a("return"),o[Symbol.asyncIterator]=function(){return this},o;function a(l){s[l]&&(o[l]=function(c){return new Promise(function(h,f){i.push([l,c,h,f])>1||r(l,c)})})}function r(l,c){try{d(s[l](c))}catch(h){O(i[0][3],h)}}function d(l){l.value instanceof p?Promise.resolve(l.value.v).then(g,v):O(i[0][2],l)}function g(l){r("next",l)}function v(l){r("throw",l)}function O(l,c){l(c),i.shift(),i.length&&r(i[0][0],i[0][1])}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const j=/^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;function lt(t){const e=t.body.pipeThrough(new TextDecoderStream("utf8",{fatal:!0})),n=ht(e),[s,o]=n.tee();return{stream:ft(s),response:ut(o)}}async function ut(t){const e=[],n=t.getReader();for(;;){const{done:s,value:o}=await n.read();if(s)return T(gt(e));e.push(o)}}function ft(t){return dt(this,arguments,function*(){const n=t.getReader();for(;;){const{value:s,done:o}=yield p(n.read());if(o)break;yield yield p(T(s))}})}function ht(t){const e=t.getReader();return new ReadableStream({start(s){let o="";return i();function i(){return e.read().then(({value:a,done:r})=>{if(r){if(o.trim()){s.error(new u("Failed to parse stream"));return}s.close();return}o+=a;let d=o.match(j),g;for(;d;){try{g=JSON.parse(d[1])}catch{s.error(new u(`Error parsing JSON response: "${d[1]}"`));return}s.enqueue(g),o=o.substring(d[0].length),d=o.match(j)}return i()})}}})}function gt(t){const e=t[t.length-1],n={promptFeedback:e==null?void 0:e.promptFeedback};for(const s of t){if(s.candidates){let o=0;for(const i of s.candidates)if(n.candidates||(n.candidates=[]),n.candidates[o]||(n.candidates[o]={index:o}),n.candidates[o].citationMetadata=i.citationMetadata,n.candidates[o].groundingMetadata=i.groundingMetadata,n.candidates[o].finishReason=i.finishReason,n.candidates[o].finishMessage=i.finishMessage,n.candidates[o].safetyRatings=i.safetyRatings,i.content&&i.content.parts){n.candidates[o].content||(n.candidates[o].content={role:i.content.role||"user",parts:[]});const a={};for(const r of i.content.parts)r.text&&(a.text=r.text),r.functionCall&&(a.functionCall=r.functionCall),r.executableCode&&(a.executableCode=r.executableCode),r.codeExecutionResult&&(a.codeExecutionResult=r.codeExecutionResult),Object.keys(a).length===0&&(a.text=""),n.candidates[o].content.parts.push(a)}o++}s.usageMetadata&&(n.usageMetadata=s.usageMetadata)}return n}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function P(t,e,n,s){const o=await A(e,_.STREAM_GENERATE_CONTENT,t,!0,JSON.stringify(n),s);return lt(o)}async function V(t,e,n,s){const i=await(await A(e,_.GENERATE_CONTENT,t,!1,JSON.stringify(n),s)).json();return{response:T(i)}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function J(t){if(t!=null){if(typeof t=="string")return{role:"system",parts:[{text:t}]};if(t.text)return{role:"system",parts:[t]};if(t.parts)return t.role?t:{role:"system",parts:t.parts}}}function y(t){let e=[];if(typeof t=="string")e=[{text:t}];else for(const n of t)typeof n=="string"?e.push({text:n}):e.push(n);return Et(e)}function Et(t){const e={role:"user",parts:[]},n={role:"function",parts:[]};let s=!1,o=!1;for(const i of t)"functionResponse"in i?(n.parts.push(i),o=!0):(e.parts.push(i),s=!0);if(s&&o)throw new u("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");if(!s&&!o)throw new u("No content is provided for sending chat message.");return s?e:n}function Ct(t,e){var n;let s={model:e==null?void 0:e.model,generationConfig:e==null?void 0:e.generationConfig,safetySettings:e==null?void 0:e.safetySettings,tools:e==null?void 0:e.tools,toolConfig:e==null?void 0:e.toolConfig,systemInstruction:e==null?void 0:e.systemInstruction,cachedContent:(n=e==null?void 0:e.cachedContent)===null||n===void 0?void 0:n.name,contents:[]};const o=t.generateContentRequest!=null;if(t.contents){if(o)throw new C("CountTokensRequest must have one of contents or generateContentRequest, not both.");s.contents=t.contents}else if(o)s=Object.assign(Object.assign({},s),t.generateContentRequest);else{const i=y(t);s.contents=[i]}return{generateContentRequest:s}}function K(t){let e;return t.contents?e=t:e={contents:[y(t)]},t.systemInstruction&&(e.systemInstruction=J(t.systemInstruction)),e}function _t(t){return typeof t=="string"||Array.isArray(t)?{content:y(t)}:t}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const B=["text","inlineData","functionCall","functionResponse","executableCode","codeExecutionResult"],vt={user:["text","inlineData"],function:["functionResponse"],model:["text","functionCall","executableCode","codeExecutionResult"],system:["text"]};function Ot(t){let e=!1;for(const n of t){const{role:s,parts:o}=n;if(!e&&s!=="user")throw new u(`First content should be with role 'user', got ${s}`);if(!M.includes(s))throw new u(`Each item should include role field. Got ${s} but valid roles are: ${JSON.stringify(M)}`);if(!Array.isArray(o))throw new u("Content should have 'parts' property with an array of Parts");if(o.length===0)throw new u("Each Content should have at least one part");const i={text:0,inlineData:0,functionCall:0,functionResponse:0,fileData:0,executableCode:0,codeExecutionResult:0};for(const r of o)for(const d of B)d in r&&(i[d]+=1);const a=vt[s];for(const r of B)if(!a.includes(r)&&i[r]>0)throw new u(`Content with role '${s}' can't contain '${r}' part`);e=!0}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Y="SILENT_ERROR";class It{constructor(e,n,s,o={}){this.model=n,this.params=s,this._requestOptions=o,this._history=[],this._sendPromise=Promise.resolve(),this._apiKey=e,s!=null&&s.history&&(Ot(s.history),this._history=s.history)}async getHistory(){return await this._sendPromise,this._history}async sendMessage(e,n={}){var s,o,i,a,r,d;await this._sendPromise;const g=y(e),v={safetySettings:(s=this.params)===null||s===void 0?void 0:s.safetySettings,generationConfig:(o=this.params)===null||o===void 0?void 0:o.generationConfig,tools:(i=this.params)===null||i===void 0?void 0:i.tools,toolConfig:(a=this.params)===null||a===void 0?void 0:a.toolConfig,systemInstruction:(r=this.params)===null||r===void 0?void 0:r.systemInstruction,cachedContent:(d=this.params)===null||d===void 0?void 0:d.cachedContent,contents:[...this._history,g]},O=Object.assign(Object.assign({},this._requestOptions),n);let l;return this._sendPromise=this._sendPromise.then(()=>V(this._apiKey,this.model,v,O)).then(c=>{var h,f;if(c.response.candidates&&c.response.candidates.length>0&&((h=c.response.candidates[0])===null||h===void 0?void 0:h.content)!==void 0){this._history.push(g);const S=Object.assign({parts:[],role:"model"},(f=c.response.candidates)===null||f===void 0?void 0:f[0].content);this._history.push(S)}else{const S=E(c.response);S&&console.warn(`sendMessage() was unsuccessful. ${S}. Inspect response object for details.`)}l=c}),await this._sendPromise,l}async sendMessageStream(e,n={}){var s,o,i,a,r,d;await this._sendPromise;const g=y(e),v={safetySettings:(s=this.params)===null||s===void 0?void 0:s.safetySettings,generationConfig:(o=this.params)===null||o===void 0?void 0:o.generationConfig,tools:(i=this.params)===null||i===void 0?void 0:i.tools,toolConfig:(a=this.params)===null||a===void 0?void 0:a.toolConfig,systemInstruction:(r=this.params)===null||r===void 0?void 0:r.systemInstruction,cachedContent:(d=this.params)===null||d===void 0?void 0:d.cachedContent,contents:[...this._history,g]},O=Object.assign(Object.assign({},this._requestOptions),n),l=P(this._apiKey,this.model,v,O);return this._sendPromise=this._sendPromise.then(()=>l).catch(c=>{throw new Error(Y)}).then(c=>c.response).then(c=>{var h;if(c.candidates&&c.candidates.length>0&&((h=c.candidates[0])===null||h===void 0?void 0:h.content)!==void 0){this._history.push(g);const f=Object.assign({},c.candidates[0].content);f.role||(f.role="model"),this._history.push(f)}else{const f=E(c);f&&console.warn(`sendMessageStream() was unsuccessful. ${f}. Inspect response object for details.`)}}).catch(c=>{c.message!==Y&&console.error(c)}),l}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Rt(t,e,n,s){return(await A(e,_.COUNT_TOKENS,t,!1,JSON.stringify(n),s)).json()}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function pt(t,e,n,s){return(await A(e,_.EMBED_CONTENT,t,!1,JSON.stringify(n),s)).json()}async function yt(t,e,n,s){const o=n.requests.map(a=>Object.assign(Object.assign({},a),{model:e}));return(await A(e,_.BATCH_EMBED_CONTENTS,t,!1,JSON.stringify({requests:o}),s)).json()}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class k{constructor(e,n,s={}){this.apiKey=e,this._requestOptions=s,n.model.includes("/")?this.model=n.model:this.model=`models/${n.model}`,this.generationConfig=n.generationConfig||{},this.safetySettings=n.safetySettings||[],this.tools=n.tools,this.toolConfig=n.toolConfig,this.systemInstruction=J(n.systemInstruction),this.cachedContent=n.cachedContent}async generateContent(e,n={}){var s;const o=K(e),i=Object.assign(Object.assign({},this._requestOptions),n);return V(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(s=this.cachedContent)===null||s===void 0?void 0:s.name},o),i)}async generateContentStream(e,n={}){var s;const o=K(e),i=Object.assign(Object.assign({},this._requestOptions),n);return P(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(s=this.cachedContent)===null||s===void 0?void 0:s.name},o),i)}startChat(e){var n;return new It(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(n=this.cachedContent)===null||n===void 0?void 0:n.name},e),this._requestOptions)}async countTokens(e,n={}){const s=Ct(e,{model:this.model,generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:this.cachedContent}),o=Object.assign(Object.assign({},this._requestOptions),n);return Rt(this.apiKey,this.model,s,o)}async embedContent(e,n={}){const s=_t(e),o=Object.assign(Object.assign({},this._requestOptions),n);return pt(this.apiKey,this.model,s,o)}async batchEmbedContents(e,n={}){const s=Object.assign(Object.assign({},this._requestOptions),n);return yt(this.apiKey,this.model,e,s)}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class At{constructor(e){this.apiKey=e}getGenerativeModel(e,n){if(!e.model)throw new u("Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })");return new k(this.apiKey,e,n)}getGenerativeModelFromCachedContent(e,n,s){if(!e.name)throw new C("Cached content must contain a `name` field.");if(!e.model)throw new C("Cached content must contain a `model` field.");const o=["model","systemInstruction"];for(const a of o)if(n!=null&&n[a]&&e[a]&&(n==null?void 0:n[a])!==e[a]){if(a==="model"){const r=n.model.startsWith("models/")?n.model.replace("models/",""):n.model,d=e.model.startsWith("models/")?e.model.replace("models/",""):e.model;if(r===d)continue}throw new C(`Different value for "${a}" specified in modelParams (${n[a]}) and cachedContent (${e[a]})`)}const i=Object.assign(Object.assign({},n),{model:e.model,tools:e.tools,toolConfig:e.toolConfig,systemInstruction:e.systemInstruction,cachedContent:e});return new k(this.apiKey,i,s)}}export{At as G};
