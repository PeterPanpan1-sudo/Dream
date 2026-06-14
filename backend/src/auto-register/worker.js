import { randomBytes, randomUUID, createHash } from 'crypto';
import { URLSearchParams } from 'url';
import { RegisterHTTPClient, AUTH_BASE, PLATFORM_BASE, UA } from './client.js';
import { SentinelGen, sentinelHeaders, randTokenURL } from './sentinel.js';
import { createRegisterMailbox, waitRegisterCode } from './mail.js';

const OAUTH_CLIENT_ID = 'app_2SKx67EdpoN0G6j64rFvigXD';
const OAUTH_REDIRECT_URI = PLATFORM_BASE + '/auth/callback';
const OAUTH_AUDIENCE = 'https://api.openai.com/v1';
const AUTH0_CLIENT = 'eyJuYW1lIjoiYXV0aDAtc3BhLWpzIiwidmVyc2lvbiI6IjEuMjEuMCJ9';

const FIRST_NAMES = ['James','Robert','John','Michael','David','Mary','Emma','Olivia'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller'];

function pick(a){return a[Math.floor(Math.random()*a.length)];}
function randPwd(n=16){
  const u='ABCDEFGHIJKLMNOPQRSTUVWXYZ',l='abcdefghijklmnopqrstuvwxyz',d='0123456789',s='!@#$%';
  const a=u+l+d+s; const v=[pick(u),pick(l),pick(d),pick(s)];
  while(v.length<n) v.push(pick(a));
  for(let i=v.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[v[i],v[j]]=[v[j],v[i]];}
  return v.join('');
}
function randName(){return[pick(FIRST_NAMES),pick(LAST_NAMES)];}
function randBirth(){return`${1996+Math.floor(Math.random()*11)}-${String(1+Math.floor(Math.random()*12)).padStart(2,'0')}-${String(1+Math.floor(Math.random()*28)).padStart(2,'0')}`;}
function pkce(){const v=randomBytes(64).toString('base64url').replace(/=/g,'');return[v,createHash('sha256').update(v).digest('base64url').replace(/=/g,'')];}
function uuid(){return randomUUID();}
function oauthCode(t){try{const u=new URL(t);return u.searchParams.get('code')||'';}catch{return'';}}
function emailDomain(e){const p=e.split('@');return p.length===2?p[1]:'';}

function authParams(email,deviceID,state,nonce,challenge){
  const p=new URLSearchParams();
  p.set('issuer',AUTH_BASE);p.set('client_id',OAUTH_CLIENT_ID);p.set('audience',OAUTH_AUDIENCE);
  p.set('redirect_uri',OAUTH_REDIRECT_URI);p.set('device_id',deviceID);p.set('screen_hint','login_or_signup');
  p.set('max_age','0');p.set('login_hint',email);p.set('scope','openid profile email offline_access');
  p.set('response_type','code');p.set('response_mode','query');p.set('state',state);p.set('nonce',nonce);
  p.set('code_challenge',challenge);p.set('code_challenge_method','S256');p.set('auth0Client',AUTH0_CLIENT);
  return p;
}

export class RegisterWorker {
  constructor(service,index,config){
    this.service=service;this.index=index;this.config=config;
    this.deviceID=uuid();this.client=new RegisterHTTPClient(config.proxy,60000,this.deviceID);
  }
  step(text){this.service.appendLog(`[任务${this.index}] ${text}`,'');}
  close(){}

  async buildSentinel(flow){
    const g=new SentinelGen(this.deviceID,UA);
    const body=JSON.stringify({p:g.reqToken(),id:this.deviceID,flow});
    const{status,data}=await this.client.raw('POST','https://sentinel.openai.com/backend-api/sentinel/req',body,sentinelHeaders());
    const token=data?.token||'';if(status!==200||!token)throw new Error(`sentinel_req_failed_${status}`);
    const proof=data?.proofofwork||{};
    const pValue=proof?.required&&proof?.seed?g.solve(String(proof.seed),String(proof.difficulty||'0')):g.reqToken();
    return JSON.stringify({p:pValue,t:'',c:token,id:this.deviceID,flow});
  }

  async run(){
    const start=Date.now();
    try{
      this.step('开始创建邮箱');
      const mbox=await createRegisterMailbox(this.config.workerUrl,this.config.adminAuth,this.config.domain);
      const email=mbox.email;if(!email)throw new Error('mail provider did not return address');
      this._lastEmail=email;
      this.step(`邮箱创建完成: ${email}`);
      const password=randPwd(16);const[fn,ln]=randName();
      await this.platformAuthorize(email);
      await this.registerUser(email,password);
      await this.sendOTP();
      this.step('开始等待注册验证码');
      const code=await waitRegisterCode(this.config.workerUrl,mbox.mailJwt,this.config.waitTimeout||60,this.config.waitInterval||3);
      if(!code)throw new Error('waiting for register verification code timed out');
      this.step(`收到注册验证码: ${code}`);
      await this.validateOTP(code);
      await this.createAccount(`${fn} ${ln}`,randBirth());
      const tokens=await this.loginAndExchangeTokens(email,password,mbox);
      tokens.email=email;tokens.password=password;tokens.created_at=new Date().toISOString();
      return{ok:true,index:this.index,result:tokens,cost:(Date.now()-start)/1000};
    }catch(err){
      return{ok:false,index:this.index,err:err.message,cost:(Date.now()-start)/1000};
    }
  }

  async platformAuthorize(email){
    this.step('开始 platform authorize');

    // Step 1: Visit platform homepage as first navigation (like opening a new tab)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 500)); // random delay 0.5-1s
    const{status:homeStatus}=await this.client.navigate(PLATFORM_BASE+'/', {}, true);
    if(homeStatus!==200&&homeStatus!==302)throw new Error(`platform_home_http_${homeStatus}`);
    this.step('platform 主页访问完成');

    // Step 2: Small delay to mimic human reading/interaction
    await new Promise(r => setTimeout(r, 800 + Math.random() * 700)); // random delay 0.8-1.5s

    // Step 3: Navigate to signup page
    const{status:signupStatus}=await this.client.navGet(PLATFORM_BASE+'/signup', PLATFORM_BASE+'/');
    if(signupStatus!==200&&signupStatus!==302)throw new Error(`platform_signup_http_${signupStatus}`);
    this.step('signup 页面访问完成');

    // Step 4: Small delay before OAuth authorize
    await new Promise(r => setTimeout(r, 300 + Math.random() * 300)); // random delay 0.3-0.6s

    // Step 5: OAuth authorize
    const[_,challenge]=pkce();
    const params=authParams(email,this.deviceID,randTokenURL(24),randTokenURL(24),challenge);
    const{status,data}=await this.client.navGet(AUTH_BASE+'/api/accounts/authorize?'+params.toString(),PLATFORM_BASE+'/signup');
    if(status!==200)throw new Error(`platform_authorize_http_${status}`+(data?.error?` ${JSON.stringify(data.error)}`:''));
    this.step('platform authorize 完成');
  }

  async registerUser(email,password){
    this.step('开始提交注册密码');
    const sentinel=await this.buildSentinel('username_password_create');
    const h=this.client.jsonHdr(AUTH_BASE+'/create-account/password');
    h['openai-sentinel-token']=sentinel;
    const{status,data}=await this.client.request('POST',AUTH_BASE+'/api/accounts/user/register',{username:email,password},h,true);
    if(status!==200)throw new Error(`user_register_http_${status}`+(data?` ${JSON.stringify(data)}`:''));
    this.step('提交注册密码完成');
  }

  async sendOTP(){
    this.step('开始发送验证码');
    const{status}=await this.client.navGet(AUTH_BASE+'/api/accounts/email-otp/send',AUTH_BASE+'/create-account/password');
    if(status!==200&&status!==302)throw new Error(`send_otp_http_${status}`);
    this.step('发送验证码完成');
  }

  async validateOTP(code){
    this.step(`开始校验验证码 ${code}`);
    const{status,data}=await this.client.request('POST',AUTH_BASE+'/api/accounts/email-otp/validate',{code},this.client.jsonHdr(AUTH_BASE+'/email-verification'),true);
    if(status!==200){
      const sentinel=await this.buildSentinel('authorize_continue');
      const h=this.client.jsonHdr(AUTH_BASE+'/email-verification');h['openai-sentinel-token']=sentinel;
      const{status:s2}=await this.client.request('POST',AUTH_BASE+'/api/accounts/email-otp/validate',{code},h,true);
      if(s2!==200)throw new Error(`validate_otp_http_${s2}`);
    }
    this.step('验证码校验完成');return data||{};
  }

  async createAccount(name,birthdate){
    this.step('开始创建账号资料');
    const sentinel=await this.buildSentinel('oauth_create_account');
    const h=this.client.jsonHdr(AUTH_BASE+'/about-you');h['openai-sentinel-token']=sentinel;
    const{status,data}=await this.client.request('POST',AUTH_BASE+'/api/accounts/create_account',{name,birthdate},h,true);
    if(status!==200&&status!==302){
      if(data?.message==='Failed to create account. Please try again.'){this.service.blockDomain(emailDomain(this._lastEmail));}
      throw new Error(`create_account_http_${status}`+(data?` ${JSON.stringify(data)}`:''));
    }
    this.step('创建账号资料完成');
  }

  async loginAndExchangeTokens(email,password,mbox){
    this.step('开始独立登录换 token');
    const loginDeviceID=uuid();const loginClient=new RegisterHTTPClient(this.config.proxy,60000,loginDeviceID);
    const origClient=this.client;this.client=loginClient;
    try{
      const[verifier,challenge]=pkce();
      const params=authParams(email,loginDeviceID,randTokenURL(24),randTokenURL(24),challenge);
      const authLogin=async()=>{const{status}=await this.client.request('GET',AUTH_BASE+'/api/accounts/authorize?'+params.toString(),null,this.client.navHdr(PLATFORM_BASE+'/'),true);if(status!==200)throw new Error(`platform_login_authorize_http_${status}`);};
      await authLogin();this.step('登录 authorize 完成');
      let{status,data}=await this.submitLoginEmail(email);
      if(status===409){this.step('邮箱提交 invalid_state，重新 authorize 后重试');this.client.clear();await authLogin();({status,data}=await this.submitLoginEmail(email));}
      if(status!==200)throw new Error(`email_submit_http_${status}`+(data?` ${JSON.stringify(data)}`:''));
      this.step('邮箱提交完成');
      const sentinel=await this.buildSentinel('password_verify');
      const h=this.client.jsonHdr(AUTH_BASE+'/log-in/password');h['openai-sentinel-token']=sentinel;
      const{status:sp,data:dp}=await this.client.request('POST',AUTH_BASE+'/api/accounts/password/verify',{password},h,true);
      if(sp!==200)throw new Error(`password_verify_http_${sp}`);
      this.step('密码校验完成');
      let continueUrl=dp?.continue_url||'';const page=dp?.page||{};
      if(page?.type==='email_otp_verification'||continueUrl.includes('email-verification')||continueUrl.includes('email-otp')){
        this.step('独立登录需要邮箱验证码');
        const c2=await waitRegisterCode(this.config.workerUrl,mbox.mailJwt,this.config.waitTimeout||60,this.config.waitInterval||3);
        if(!c2)throw new Error('independent login waiting for verification code timed out');
        const otpPayload=await this.validateOTPCode(c2);
        if(otpPayload?.continue_url)continueUrl=otpPayload.continue_url;
        this.step('独立登录验证码校验完成');
      }
      if(!continueUrl)continueUrl=AUTH_BASE+'/sign-in-with-chatgpt/codex/consent';
      const callbackCode=await this.followConsentForCode(continueUrl);
      if(!callbackCode)throw new Error('token exchange callback code not found');
      // clean client for OAuth token exchange
      const cleanClient=new RegisterHTTPClient(this.config.proxy,60000,uuid());
      const form=new URLSearchParams();
      form.set('grant_type','authorization_code');form.set('code',callbackCode);
      form.set('redirect_uri',OAUTH_REDIRECT_URI);form.set('client_id',OAUTH_CLIENT_ID);
      form.set('code_verifier',verifier);
      const{status:ts,data:tp}=await cleanClient.form(AUTH_BASE+'/oauth/token',form);
      if(ts!==200)throw new Error(`oauth_token_http_${ts}`);
      const{access_token,refresh_token,id_token}=tp||{};
      if(!access_token||!refresh_token||!id_token)throw new Error('token exchange response missing fields');
      this.step('token 换取完成');
      return{access_token,refresh_token,id_token};
    }finally{this.client=origClient;}
  }

  async submitLoginEmail(email){
    this.step('开始提交邮箱');
    const sentinel=await this.buildSentinel('authorize_continue');
    const h=this.client.jsonHdr(AUTH_BASE+'/log-in?usernameKind=email');h['openai-sentinel-token']=sentinel;
    return this.client.request('POST',AUTH_BASE+'/api/accounts/authorize/continue',{username:{kind:'email',value:email}},h,true);
  }

  async validateOTPCode(code){
    const{status,data}=await this.client.request('POST',AUTH_BASE+'/api/accounts/email-otp/validate',{code},this.client.jsonHdr(AUTH_BASE+'/email-verification'),true);
    if(status===200)return data||{};
    const sentinel=await this.buildSentinel('authorize_continue');
    const h=this.client.jsonHdr(AUTH_BASE+'/email-verification');h['openai-sentinel-token']=sentinel;
    const{status:s2,data:d2}=await this.client.request('POST',AUTH_BASE+'/api/accounts/email-otp/validate',{code},h,true);
    if(s2!==200)throw new Error(`validate_otp_http_${s2}`);
    return d2||{};
  }

  async followConsentForCode(continueUrl){
    let current=continueUrl;if(current.startsWith('/'))current=AUTH_BASE+current;
    for(let i=0;i<10;i++){
      const res=await this.client.navigate(current);
      if(oauthCode(res.url))return oauthCode(res.url);
      const loc=(res.headers.get('location')||'').trim();
      if(oauthCode(loc))return oauthCode(loc);
      if(!loc||(res.status<300||res.status>=400))break;
      current=new URL(loc,current).toString();
    }
    let cur=continueUrl;if(cur.startsWith('/'))cur=AUTH_BASE+cur;
    const locations=[];
    for(let i=0;i<15;i++){
      const res=await this.client.navigate(cur);
      if(oauthCode(res.url))return oauthCode(res.url);
      const loc=(res.headers.get('location')||'').trim();
      if(loc){locations.push(loc);if(oauthCode(loc))return oauthCode(loc);}
      if(!loc||(res.status<300||res.status>=400))break;
      cur=new URL(loc,cur).toString();
    }
    for(const loc of locations){if(oauthCode(loc))return oauthCode(loc);}
    return'';
  }
}
