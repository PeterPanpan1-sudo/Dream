/**
 * 出站代理支持。
 *
 * ChatGPT 仅对部分地区/网络开放，服务器直连 chatgpt.com 常见 connect ETIMEDOUT。
 * 通过环境变量配置代理后，所有对上游的请求都会走代理。
 *
 * 支持的环境变量（按优先级）:
 *   CHATGPT_PROXY  - 专用于 ChatGPT 上游的代理
 *   HTTPS_PROXY / https_proxy
 *   ALL_PROXY / all_proxy
 *
 * 取值示例: http://127.0.0.1:7890  或  http://user:pass@host:port
 */

export function getProxyUrl() {
  return (
    process.env.CHATGPT_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    ''
  ).trim();
}
