/* Business dashboard — vanilla JS, all data in localStorage */
const K='bz_db_v1';
const D=Object.assign({settings:{},clients:[],vendors:[],invoices:[]},JSON.parse(localStorage.getItem(K)||'{}'));
const save=()=>localStorage.setItem(K,JSON.stringify(D));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const f2=n=>(+n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const inr=n=>'₹'+f2(n);
const today=()=>new Date().toLocaleDateString('en-CA');
const T={client:{list:'clients',label:'Client'},vendor:{list:'vendors',label:'Vendor'}};
const S={f:{},edit:null,arch:false,inv:null,ro:false};
const toast=m=>{const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);setTimeout(()=>d.remove(),1800)};
const goto=h=>location.hash==='#'+h?route():location.hash=h;

function words(n){n=Math.round(n);if(!n)return'Zero';
 const a='One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen Fifteen Sixteen Seventeen Eighteen Nineteen'.split(' '),b='_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety'.split(' ');
 const two=x=>x<20?(a[x-1]||''):b[Math.floor(x/10)]+(x%10?' '+a[x%10-1]:'');let s='';
 [[1e7,'Crore'],[1e5,'Lakh'],[1e3,'Thousand'],[100,'Hundred']].forEach(([v,l])=>{if(n>=v){const q=Math.floor(n/v);s+=(v===1e7&&q>=100?words(q):two(q))+' '+l+' ';n%=v}});
 return(s+(n?two(n):'')).trim()}
const calc=i=>{let sub=0,tax=0,q=0;i.rows.forEach(r=>{const a=r.q*r.r;sub+=a;tax+=a*r.g/100;q+=r.q});return{sub,tax,q,c:tax/2,total:Math.round((sub+tax)*100)/100}};
const stat=i=>{const t=calc(i).total;return t>0&&i.paid>=t-.005?'Paid':i.paid>0?'Partial':'Unpaid'};
const hd=(pill,title,desc,extra='')=>`<div class="page-header"><div class="head-row"><div><div class="category-pill">${pill}</div><h1 class="page-title">${title}</h1><p class="page-description">${desc}</p></div>${extra}</div></div>`;
const partyOf=(t,id)=>D[T[t].list].find(x=>x.id===id)||{};

/* ---------- router ---------- */
function route(){
 const [r,t,id]=(location.hash.slice(1)||'home').split('/');S.f={};
 const map={home:'home',clients:'clients',vendors:'vendors','client-dash':'client-dash','vendor-dash':'vendor-dash',ledger:t+'s',invoice:t+'-dash'};
 $$('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.r===map[r]));
 $('#nav-brand-name').textContent=D.settings.name||'My Company';
 $('#view').innerHTML=r==='settings'?settings():r==='clients'||r==='vendors'?parties(r==='clients'?'client':'vendor'):r.endsWith('-dash')?dash(r.split('-')[0]):r==='ledger'?ledger(t,id):r==='invoice'?invoice(t,id):home();
 if(r==='invoice')paint();scrollTo(0,0)}
addEventListener('hashchange',route);addEventListener('DOMContentLoaded',route);

/* ---------- home ---------- */
function home(){const s=D.settings,sum=t=>D.invoices.filter(i=>i.type===t).reduce((a,i)=>[a[0]+calc(i).total,a[1]+(+i.paid||0)],[0,0]);
 const [ct,cp]=sum('client'),[vt,vp]=sum('vendor');
 const rec=[...D.invoices].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 return`<div class="content-card">${hd('Central Hub',E(s.name||'Main Dashboard'),E(s.tagline||'Set up your company in Settings to fill invoice headers.'))}
 <div class="company-badge-panel"><div class="badge-item"><span class="badge-label">Contact</span><span class="badge-val">${E(s.mobile||'Not configured')}</span></div><div class="badge-item"><span class="badge-label">GST</span><span class="badge-val">${E(s.gst||'Not configured')}</span></div><div class="badge-item"><span class="badge-label">Address</span><span class="badge-val">${E(s.address||'Not configured')}</span></div></div>
 <div class="stats"><div class="stat"><small>To receive from clients</small><b>${inr(ct-cp)}</b></div><div class="stat"><small>To pay vendors</small><b>${inr(vt-vp)}</b></div><div class="stat"><small>Clients</small><b>${D.clients.filter(x=>!x.arch).length}</b></div><div class="stat"><small>Vendors</small><b>${D.vendors.filter(x=>!x.arch).length}</b></div></div>
 <div class="row-end" style="justify-content:flex-start;margin:0 0 20px"><button class="primary-btn" data-act="new-inv" data-t="client">Create client invoice</button><button class="neutral-btn" data-act="new-inv" data-t="vendor">Create vendor invoice</button></div>
 <div class="card-sub"><h3>Recent invoices</h3>${rec.length?`<div class="tscroll"><table class="dt"><tbody>${rec.map(i=>`<tr><td>${E(i.no)}</td><td>${i.type}</td><td>${E(i.pName)}</td><td>${inr(calc(i).total)}</td><td><span class="pill ${stat(i)}">${stat(i)}</span></td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">No invoices yet. Create your first one above.</p>'}</div></div>`}

/* ---------- settings ---------- */
function settings(){const s=D.settings;
 const fl=(k,l,ph='',x='')=>`<div class="form-group ${x}"><label class="form-label">${l}</label>${x?`<textarea class="form-input" name="${k}" rows="2">${E(s[k])}</textarea>`:`<input class="form-input" name="${k}" value="${E(s[k])}" placeholder="${ph}">`}</div>`;
 return`<div class="content-card">${hd('Configuration','Global settings','These details fill the header of every invoice.')}
 <form data-form="settings"><div class="fgrid">${fl('name','Company name')}${fl('tagline','Tagline')}${fl('address','Full address','','span2')}${fl('mobile','Mobile number')}${fl('gst','GST number')}
 <div class="form-group span2"><label class="form-label">Header image / logo</label><input type="file" accept="image/*" class="form-input" data-logo><div id="logo-prev">${s.logo?`<img src="${s.logo}" style="max-height:70px;margin-top:8px">`:''}</div></div>
 ${fl('bank','Bank name')}${fl('ac','Account number')}${fl('ifsc','Branch & IFSC code')}</div>
 <div class="row-end"><button class="primary-btn">Save settings</button></div></form></div>`}

/* ---------- client / vendor management ---------- */
function parties(t){const c=T[t],e=D[c.list].find(x=>x.id===S.edit)||{};
 const F=[['name','Name'],['key','Unique search keyword'],['contact','Contact person'],['mobile','Mobile number'],['email','Email address'],['gst','GST number'],['address','Billing address',1],['notes','Description / notes',1]];
 return`<div class="content-card">${hd(c.label+'s',c.label+' management',`Add, edit and review your ${c.label.toLowerCase()}s.`)}
 <div class="card-sub"><h3>${e.id?'Edit':'New'} ${c.label.toLowerCase()}</h3><form data-form="party" data-t="${t}"><div class="fgrid">${F.map(([k,l,x])=>`<div class="form-group ${x?'span2':''}"><label class="form-label">${l}</label>${x?`<textarea class="form-input" name="${k}" rows="2">${E(e[k])}</textarea>`:`<input class="form-input" name="${k}" value="${E(e[k])}" ${k==='name'?'required':''}>`}</div>`).join('')}</div>
 <div class="row-end">${e.id?'<button type="button" class="neutral-btn" data-act="cancel-edit">Cancel</button>':''}<button class="primary-btn">${e.id?'Update':'Save'} ${c.label.toLowerCase()}</button></div></form></div>
 <div class="card-sub"><div class="toolbar"><input class="form-input" placeholder="Search name, keyword, mobile, GST" data-fl="q" data-v="p" data-t="${t}"><label class="muted"><input type="checkbox" data-arch> Show archived</label></div><div class="tscroll" id="tb">${ptbl(t)}</div></div></div>`}
function ptbl(t){const q=(S.f.q||'').toLowerCase();
 const L=D[T[t].list].filter(x=>(S.arch||!x.arch)&&`${x.name} ${x.key} ${x.contact} ${x.mobile} ${x.gst}`.toLowerCase().includes(q));
 return L.length?`<table class="dt"><thead><tr><th>Name</th><th>Keyword</th><th>Contact</th><th>Mobile</th><th>GST</th><th></th></tr></thead><tbody>${L.map(x=>`<tr class="${x.arch?'dim':''}"><td><b>${E(x.name)}</b></td><td>${E(x.key)}</td><td>${E(x.contact)}</td><td>${E(x.mobile)}</td><td>${E(x.gst)}</td><td class="acts"><button class="sm primary" data-act="ledger" data-t="${t}" data-id="${x.id}">Ledger</button><button class="sm" data-act="edit-party" data-id="${x.id}">Edit</button><button class="sm" data-act="arch" data-t="${t}" data-id="${x.id}">${x.arch?'Unarchive':'Archive'}</button></td></tr>`).join('')}</tbody></table>`:`<p class="muted">No ${T[t].label.toLowerCase()}s found. Add one using the form above.</p>`}

function ledger(t,id){const p=partyOf(t,id),I=D.invoices.filter(i=>i.type===t&&i.partyId===id);
 const tot=I.reduce((s,i)=>s+calc(i).total,0),pd=I.reduce((s,i)=>s+(+i.paid||0),0);
 const row=(l,v)=>`<div class="badge-item"><span class="badge-label">${l}</span><span class="badge-val">${E(v)||'—'}</span></div>`;
 return`<div class="content-card">${hd(T[t].label+' ledger',E(p.name||'Not found'),'Profile and complete transaction history.',`<button class="neutral-btn" data-act="route" data-r="${T[t].list}">← Back</button>`)}
 <div class="company-badge-panel">${row('Contact',p.contact)}${row('Mobile',p.mobile)}${row('Email',p.email)}${row('GST',p.gst)}${row('Address',p.address)}${row('Notes',p.notes)}</div>
 <div class="stats"><div class="stat"><small>Total billed</small><b>${inr(tot)}</b></div><div class="stat"><small>Paid</small><b>${inr(pd)}</b></div><div class="stat"><small>Balance</small><b>${inr(tot-pd)}</b></div></div>
 <div class="tscroll">${I.length?`<table class="dt"><thead><tr><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${I.sort((a,b)=>b.date.localeCompare(a.date)).map(i=>`<tr><td>${E(i.no)}</td><td>${i.date}</td><td>${inr(calc(i).total)}</td><td>${inr(i.paid)}</td><td>${inr(calc(i).total-i.paid)}</td><td><span class="pill ${stat(i)}">${stat(i)}</span></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No transactions yet.</p>'}</div></div>`}

/* ---------- invoice dashboards ---------- */
function dash(t){const cl=t==='client',I=D.invoices.filter(i=>i.type===t),tot=I.reduce((s,i)=>s+calc(i).total,0),pd=I.reduce((s,i)=>s+(+i.paid||0),0);
 const now=new Date(),m=[...Array(6)].map((_,k)=>{const d=new Date(now.getFullYear(),now.getMonth()-5+k,1);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`});
 const v=m.map(k=>I.filter(i=>i.date.startsWith(k)).reduce((s,i)=>s+calc(i).total,0)),mx=Math.max(...v,1);
 const ps=D[T[t].list];
 return`<div class="content-card">${hd(cl?'Analytics':'Payables',T[t].label+' dashboard',cl?'Client invoices, revenue and pending payments.':'Vendor invoices, expenses and pending payables.',`<button class="primary-btn" data-act="new-inv" data-t="${t}">Create ${t} invoice</button>`)}
 <div class="stats"><div class="stat"><small>${cl?'Total revenue':'Total expenses'}</small><b>${inr(tot)}</b></div><div class="stat"><small>${cl?'Received':'Paid'}</small><b>${inr(pd)}</b></div><div class="stat"><small>${cl?'Pending payments':'Pending payables'}</small><b>${inr(tot-pd)}</b></div><div class="stat"><small>Invoices</small><b>${I.length}</b></div></div>
 <div class="card-sub"><h3>Last 6 months</h3><div class="chart">${v.map((x,k)=>`<div class="bar" title="${inr(x)}"><i style="height:${x/mx*80}%"></i><span>${m[k].slice(5)}/${m[k].slice(2,4)}</span></div>`).join('')}</div></div>
 <div class="card-sub"><h3>Invoice records</h3><div class="toolbar"><input class="form-input" placeholder="Search number, party, order no." data-fl="q" data-v="d" data-t="${t}">
 <select class="form-input" data-fl="st" data-v="d" data-t="${t}"><option value="">All statuses</option><option>Paid</option><option>Partial</option><option>Unpaid</option></select>
 <select class="form-input" data-fl="p" data-v="d" data-t="${t}"><option value="">All ${T[t].label.toLowerCase()}s</option>${ps.map(p=>`<option value="${p.id}">${E(p.name)}</option>`).join('')}</select>
 <input type="date" class="form-input" data-fl="from" data-v="d" data-t="${t}" title="From"><input type="date" class="form-input" data-fl="to" data-v="d" data-t="${t}" title="To"></div>
 <div class="tscroll" id="tb">${dtbl(t)}</div></div></div>`}
function dtbl(t){const F=S.f,q=(F.q||'').toLowerCase();
 const L=D.invoices.filter(i=>i.type===t&&`${i.no} ${i.pName} ${i.orderNo}`.toLowerCase().includes(q)&&(!F.st||stat(i)===F.st)&&(!F.p||i.partyId===F.p)&&(!F.from||i.date>=F.from)&&(!F.to||i.date<=F.to)).sort((a,b)=>b.date.localeCompare(a.date));
 return L.length?`<table class="dt"><thead><tr><th>Invoice</th><th>Date</th><th>Party</th><th>Total</th><th>Paid</th><th>Status</th><th></th></tr></thead><tbody>${L.map(i=>`<tr><td><b>${E(i.no)}</b></td><td>${i.date}</td><td>${E(i.pName)}</td><td>${inr(calc(i).total)}</td><td>${inr(i.paid)}</td><td><span class="pill ${stat(i)}">${stat(i)}</span></td><td class="acts">${['view','pay','edit','print','dup'].map(a=>`<button class="sm" data-act="${a}-inv" data-id="${i.id}">${{view:'View',pay:'Payment',edit:'Edit',print:'Print',dup:'Duplicate'}[a]}</button>`).join('')}</td></tr>`).join('')}</tbody></table>`:'<p class="muted">No invoices match. Create one or adjust the filters.</p>'}

/* ---------- paper invoice ---------- */
const blank=()=>({n:'',s:'',q:0,r:0,g:18});
function invoice(t,id){const old=D.invoices.find(i=>i.id===id),s=D.settings;if(id==='__keep')t=S.inv.type;
 if(id==='__keep'){}
 else if(old)S.inv=JSON.parse(JSON.stringify(old));
 else{const mx=Math.max(1000,...D.invoices.filter(i=>i.type===t).map(i=>parseInt(i.no)||0));
  S.inv={id:uid(),type:t,no:String(mx+1),date:today(),orderNo:'',orderDate:'',partyId:'',pName:'',pAddr:'',pMobile:'',pGst:'',rows:[blank()],bank:{name:s.bank||'',ac:s.ac||'',ifsc:s.ifsc||''},paid:0,isNew:1};S.ro=false}
 const i=S.inv,d=S.ro?'disabled':'',inp=(f,x='')=>`<input data-i="${f}" value="${E(i[f])}" ${d} ${x}>`,bk=(k)=>`<input data-b="${k}" value="${E(i.bank[k])}" ${d}>`;
 return`<div class="inv-bar no-print"><button class="neutral-btn" data-act="route" data-r="${t}-dash">← Back</button><div class="acts">${S.ro?'<button class="neutral-btn" data-act="unlock">Edit</button>':'<button class="primary-btn" data-act="save-inv">Save invoice</button>'}<button class="neutral-btn" data-act="print">Print</button></div></div>
 <div class="sheet-wrap"><div class="sheet">
 <div class="sh-head"><div>${s.logo?`<img src="${s.logo}" alt="">`:''}</div><div><div class="sh-name">${E(s.name||'Your Company Name')}</div><div class="sh-sub">${E(s.tagline)}</div><div class="sh-sub">${E(s.address)} ${s.mobile?'· '+E(s.mobile):''}</div></div><div class="sh-gst">GST : ${E(s.gst)}</div></div>
 <div class="sh-title">${t==='client'?'TAX INVOICE':'PURCHASE INVOICE'}</div>
 <div class="sh-party"><div><div class="ln"><b>Party :</b>${S.ro?'':`<select class="psel" data-i="partyId"><option value="">Select…</option>${D[T[t].list].filter(p=>!p.arch).map(p=>`<option value="${p.id}" ${p.id===i.partyId?'selected':''}>${E(p.name)}</option>`).join('')}</select>`}${inp('pName','placeholder="Party name"')}</div>
  <div class="ln"><b>Address</b><textarea data-i="pAddr" rows="2" ${d}>${E(i.pAddr)}</textarea></div><div class="ln"><b>Mobile No.</b>${inp('pMobile')}</div><div class="ln"><b>GST</b>${inp('pGst')}</div></div>
  <div><div class="ln"><b>Invoice No. :</b>${inp('no')}</div><div class="ln"><b>Date :</b>${inp('date','type="date"')}</div><div class="ln"><b>Order No. :</b>${inp('orderNo')}</div><div class="ln"><b>Date :</b>${inp('orderDate','type="date"')}</div></div></div>
 <table class="gt"><thead><tr><th>Sr.</th><th>Item Name</th><th style="width:70px">Qty.</th><th style="width:90px">Rate</th><th style="width:100px">Amount</th><th style="width:54px">GST %</th><th style="width:84px">CGST</th><th style="width:84px">SGST</th><th style="width:100px">Total Value</th><th class="no-print" style="width:24px"></th></tr></thead>
 <tbody id="rows">${i.rows.map((r,k)=>`<tr class="row"><td>${k+1}</td><td><input data-r="n" value="${E(r.n)}" ${d} placeholder="Item"><input class="sub" data-r="s" value="${E(r.s)}" ${d} placeholder="note / item no."></td><td><input class="num" type="number" min="0" data-r="q" value="${r.q||''}" ${d}></td><td><input class="num" type="number" min="0" step="any" data-r="r" value="${r.r||''}" ${d}></td><td class="n a"></td><td><input class="num" type="number" min="0" step="any" data-r="g" value="${r.g}" ${d}></td><td class="n c"></td><td class="n c"></td><td class="n t"></td><td class="no-print">${S.ro?'':'<button class="del" data-act="del-row" data-k="'+k+'" title="Remove row">×</button>'}</td></tr>`).join('')}</tbody>
 <tfoot><tr><th></th><th style="text-align:right">Total</th><th data-o="tq"></th><th></th><th class="n" data-o="ta"></th><th></th><th class="n" data-o="tc"></th><th class="n" data-o="tc"></th><th class="n" data-o="tt"></th><th class="no-print"></th></tr></tfoot></table>
 ${S.ro?'':'<div class="no-print" style="margin:8px 0"><button class="sm" data-act="add-row">+ Add item row</button></div>'}
 <div class="sh-foot"><div><b>Amount in words :</b> <span data-o="w"></span><div style="margin-top:10px"><b>Company's Bank Details</b><div class="ln"><b>Bank Name</b>${bk('name')}</div><div class="ln"><b>A/c No.</b>${bk('ac')}</div><div class="ln"><b>Branch &amp; IFSC</b>${bk('ifsc')}</div></div></div>
  <div><div class="sh-sum"><span>Cgst</span><span data-o="gc"></span></div><div class="sh-sum"><span>Sgst</span><span data-o="gc"></span></div><div class="sh-sum g"><span>Grand Total</span><span data-o="gt"></span></div><div style="text-align:right;margin-top:14px;font-weight:700">for ${E(s.name||'Your Company')}</div><div class="sig">Authorised Signatory</div></div></div>
 </div></div>`}
function paint(){const i=S.inv;if(!i)return;const c=calc(i);
 $$('#rows tr').forEach((tr,k)=>{const r=i.rows[k],a=r.q*r.r,x=a*r.g/200;tr.querySelector('.a').textContent=f2(a);tr.querySelectorAll('.c').forEach(e=>e.textContent=f2(x));tr.querySelector('.t').textContent=f2(a+2*x)});
 const o={tq:c.q,ta:f2(c.sub),tc:f2(c.c),tt:f2(c.sub+c.tax),gc:f2(c.c),gt:f2(c.total),w:'INR '+words(c.total)+' Only'};
 $$('[data-o]').forEach(e=>e.textContent=o[e.dataset.o])}

/* ---------- events ---------- */
document.addEventListener('input',e=>{const el=e.target,ds=el.dataset;
 if(ds.fl){S.f[ds.fl]=el.value;$('#tb').innerHTML=(ds.v==='p'?ptbl:dtbl)(ds.t);return}
 if(ds.arch!==undefined){S.arch=el.checked;$('#tb').innerHTML=ptbl($('[data-v=p]').dataset.t);return}
 if(ds.logo!==undefined){const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,500/im.width),cv=document.createElement('canvas');cv.width=im.width*k;cv.height=im.height*k;cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);D.settings.logo=cv.toDataURL('image/png');save();$('#logo-prev').innerHTML=`<img src="${D.settings.logo}" style="max-height:70px;margin-top:8px">`};im.src=fr.result};fr.readAsDataURL(el.files[0]);return}
 const i=S.inv;if(!i)return;
 if(ds.b)i.bank[ds.b]=el.value;
 else if(ds.r){const r=i.rows[el.closest('tr').rowIndex-1];r[ds.r]=['q','r','g'].includes(ds.r)?+el.value||0:el.value;paint()}
 else if(ds.i){i[ds.i]=el.value;if(ds.i==='partyId'){const p=partyOf(i.type,el.value);Object.assign(i,{pName:p.name||'',pAddr:p.address||'',pMobile:p.mobile||'',pGst:p.gst||''});['pName','pAddr','pMobile','pGst'].forEach(k=>$(`[data-i=${k}]`).value=i[k])}}});

document.addEventListener('submit',e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));
 if(f.dataset.form==='party'){const L=D[T[f.dataset.t].list];S.edit?Object.assign(L.find(x=>x.id===S.edit),d):L.push({id:uid(),arch:false,...d});S.edit=null;save();toast('Saved');route()}
 if(f.dataset.form==='settings'){Object.assign(D.settings,d);save();toast('Settings saved');route()}});

document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const ds=b.dataset,A=ds.act,inv=()=>D.invoices.find(i=>i.id===ds.id);
 if(A==='route')goto(ds.r);
 else if(A==='ledger')goto(`ledger/${ds.t}/${ds.id}`);
 else if(A==='edit-party'){S.edit=ds.id;route();scrollTo(0,0)}
 else if(A==='cancel-edit'){S.edit=null;route()}
 else if(A==='arch'){const p=partyOf(ds.t,ds.id);p.arch=!p.arch;save();$('#tb').innerHTML=ptbl(ds.t)}
 else if(A==='new-inv'){S.ro=false;goto(`invoice/${ds.t}/new`)}
 else if(A==='view-inv'||A==='edit-inv'){S.ro=A==='view-inv';goto(`invoice/${inv().type}/${ds.id}`)}
 else if(A==='print-inv'){S.ro=true;goto(`invoice/${inv().type}/${ds.id}`);setTimeout(print,400)}
 else if(A==='print')print();
 else if(A==='unlock'){S.ro=false;keep()}
 else if(A==='pay-inv'){const i=inv(),v=prompt(`Total paid so far (invoice total ${inr(calc(i).total)}):`,i.paid||0);if(v!==null&&!isNaN(+v)){i.paid=Math.max(0,+v);save();$('#tb').innerHTML=dtbl(i.type);toast('Payment updated')}}
 else if(A==='dup-inv'){const o=inv(),mx=Math.max(1000,...D.invoices.filter(i=>i.type===o.type).map(i=>parseInt(i.no)||0)),n={...JSON.parse(JSON.stringify(o)),id:uid(),no:String(mx+1),date:today(),paid:0};D.invoices.push(n);save();S.ro=false;toast('Duplicated');goto(`invoice/${n.type}/${n.id}`)}
 else if(A==='add-row'){S.inv.rows.push(blank());keep()}
 else if(A==='del-row'){if(S.inv.rows.length>1){S.inv.rows.splice(+ds.k,1);keep()}}
 else if(A==='save-inv'){const i=S.inv;if(!i.pName.trim())return toast('Enter a party name first');delete i.isNew;const x=D.invoices.findIndex(v=>v.id===i.id);x<0?D.invoices.push(i):D.invoices[x]=i;save();toast('Invoice saved');goto(i.type+'-dash')}});
function keep(){const i=S.inv;$('#view').innerHTML=invoice(i.type,'__keep');paint()}
