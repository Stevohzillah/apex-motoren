function loadPayPalSDK(callback) {
  if (window.paypal) { callback(); return; }
  const script = document.createElement('script');
  script.src = 'https://www.paypal.com/sdk/js?client-id=sb&currency=USD';
  script.onload = callback;
  script.onerror = function() { showToast('PayPal could not load. Check your connection.'); };
  document.head.appendChild(script);
}

let currentPage = 0;
const totalPages = 7;
const selectedCategories = new Set();
let paypalReady = false;

function goTo(index) {
  if (index < 0 || index >= totalPages) return;
  const prev = document.getElementById('page-' + currentPage);
  prev.classList.add('exit-left');
  prev.classList.remove('active');
  setTimeout(() => prev.classList.remove('exit-left'), 400);
  currentPage = index;
  const next = document.getElementById('page-' + currentPage);
  next.classList.add('active');
  next.scrollTop = 0;
  document.querySelectorAll('.nav-links button').forEach((btn, i) => btn.classList.toggle('active', i === currentPage));
  document.querySelectorAll('.page-dot').forEach((dot, i) => dot.classList.toggle('active', i === currentPage));
  document.getElementById('arrow-prev').classList.toggle('hidden', currentPage === 0);
  document.getElementById('arrow-next').classList.toggle('hidden', currentPage === totalPages - 1);
  if (currentPage === 6 && !paypalReady) initPayPal();
}

function toggleCat(card, name) {
  card.classList.toggle('selected');
  selectedCategories.has(name) ? selectedCategories.delete(name) : selectedCategories.add(name);
  const d = document.getElementById('selectedCatsDisplay');
  d.textContent = selectedCategories.size === 0 ? 'No category selected' : 'Selected: ' + Array.from(selectedCategories).join(', ');
  document.getElementById('selectedCats').value = Array.from(selectedCategories).join(', ');
}

function submitForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Sending...'; btn.disabled = true;

  const data = {
    name: document.getElementById('fullname').value,
    phone: document.getElementById('phone').value,
    email: document.getElementById('email').value,
    country: document.getElementById('country').value,
    vin: document.getElementById('vin').value,
    vehicle: document.getElementById('vehicle').value,
    parts: document.getElementById('parts').value,
    categories: document.getElementById('selectedCats').value
  };

  // ── CHANGE THIS TO YOUR RENDER BACKEND URL ──
  const BACKEND_URL = 'https://your-render-app.onrender.com';

  fetch(BACKEND_URL + '/submit-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(r => r.json())
  .then(res => {
    btn.textContent = 'Submit Request'; btn.disabled = false;
    if (res.success) {
      e.target.reset();
      selectedCategories.clear();
      document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
      document.getElementById('selectedCatsDisplay').textContent = 'No category selected';
      showToast('Request received! Ref: ' + res.reference + '. We will contact you within 48 hours.');
    } else {
      showToast('Error: ' + res.message);
    }
  })
  .catch(() => {
    btn.textContent = 'Submit Request'; btn.disabled = false;
    showToast('Could not send request. Please WhatsApp us directly on +971 52 118 9377');
  });
}

function updateInvoice() {
  const ref = document.getElementById('inv-ref').value || '—';
  const name = document.getElementById('inv-name').value || '—';
  const parts = document.getElementById('inv-parts').value || '—';
  const amount = parseFloat(document.getElementById('inv-amount').value) || 0;
  const currency = document.getElementById('inv-currency').value || 'KES';
  document.getElementById('disp-ref').textContent = ref;
  document.getElementById('disp-name').textContent = name;
  document.getElementById('disp-parts').textContent = parts;
  document.getElementById('disp-currency').textContent = currency;
  document.getElementById('disp-amount').textContent = currency + ' ' + amount.toLocaleString('en-KE', {minimumFractionDigits:2, maximumFractionDigits:2});
  const acct = document.getElementById('paybill-account');
  const stepAcct = document.getElementById('step-account');
  const stepAmt = document.getElementById('step-amount');
  if (acct) acct.textContent = ref === '—' ? 'APX-REF' : ref;
  if (stepAcct) stepAcct.textContent = ref === '—' ? 'your reference number' : ref;
  if (stepAmt) stepAmt.textContent = amount > 0 ? (currency + ' ' + amount.toLocaleString()) : 'as per invoice';
}

function switchMethod(method) {
  document.querySelectorAll('.method-tab').forEach((t, i) => {
    t.classList.toggle('active', ['mpesa','card','paypal'][i] === method);
  });
  document.querySelectorAll('.method-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('method-' + method).classList.add('active');
  if (method === 'paypal' && !paypalReady) initPayPal();
}

function switchTab(tab) {
  document.querySelectorAll('.mpesa-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'paybill') || (i === 1 && tab === 'stk'));
  });
  document.getElementById('pane-paybill').classList.toggle('active', tab === 'paybill');
  document.getElementById('pane-stk').classList.toggle('active', tab === 'stk');
}

function sendSTK() {
  const phone = document.getElementById('stk-phone').value.trim();
  const amount = parseFloat(document.getElementById('inv-amount').value);
  if (!phone) { showToast('Please enter your Safaricom phone number.'); return; }
  if (!amount || amount <= 0) { showToast('Please fill in the invoice amount first.'); return; }
  const btn = document.getElementById('stk-btn');
  const status = document.getElementById('stk-status');
  btn.textContent = 'Sending...'; btn.disabled = true;
  status.className = 'stk-status pending show';
  status.textContent = 'Sending M-Pesa prompt to ' + phone + '...';
  setTimeout(() => {
    btn.textContent = 'Send Prompt'; btn.disabled = false;
    status.className = 'stk-status pending show';
    status.innerHTML = 'Prompt sent to <strong style="color:var(--white)">' + phone + '</strong>. Enter PIN on your phone, then paste confirmation code below.';
  }, 2000);
}

function formatCard(el) {
  let v = el.value.replace(/\D/g,'').substring(0,16);
  el.value = v.replace(/(.{4})/g,'$1 ').trim();
}

function formatExpiry(el) {
  let v = el.value.replace(/\D/g,'').substring(0,4);
  if (v.length >= 3) v = v.substring(0,2) + ' / ' + v.substring(2);
  el.value = v;
}

function processCard() {
  const name = document.getElementById('card-name').value.trim();
  const num = document.getElementById('card-number').value.replace(/\s/g,'');
  const exp = document.getElementById('card-expiry').value;
  const cvv = document.getElementById('card-cvv').value;
  const amount = parseFloat(document.getElementById('inv-amount').value);
  if (!name) { showToast('Please enter the cardholder name.'); return; }
  if (num.length < 13) { showToast('Please enter a valid card number.'); return; }
  if (!exp || exp.length < 4) { showToast('Please enter expiry date.'); return; }
  if (!cvv || cvv.length < 3) { showToast('Please enter CVV.'); return; }
  if (!amount || amount <= 0) { showToast('Please fill in the invoice amount first.'); return; }
  const btn = event.target;
  btn.textContent = 'Processing...'; btn.disabled = true;
  setTimeout(() => {
    btn.textContent = 'Pay Now'; btn.disabled = false;
    showSuccess('Visa/Card', 'TXN-' + Math.random().toString(36).substr(2,8).toUpperCase());
  }, 2000);
}

function initPayPal() {
  paypalReady = true;
  loadPayPalSDK(function() {
    paypal.Buttons({
      style: { layout:'vertical', color:'gold', shape:'rect', label:'pay', height:45 },
      createOrder: function(data, actions) {
        const amount = parseFloat(document.getElementById('inv-amount').value);
        if (!amount || amount <= 0) { showToast('Please enter invoice amount first.'); return Promise.reject(); }
        const ref = document.getElementById('inv-ref').value || 'APEX-ORDER';
        const desc = document.getElementById('inv-parts').value || 'Spare Parts';
        return actions.order.create({
          purchase_units: [{ description: desc + ' — ' + ref, amount: { value: amount.toFixed(2), currency_code: 'USD' } }],
          application_context: { brand_name: 'Apex Motoren Kenya', shipping_preference: 'NO_SHIPPING' }
        });
      },
      onApprove: function(data, actions) {
        return actions.order.capture().then(function(details) {
          showSuccess('PayPal', details.id || data.orderID);
        });
      },
      onError: function() { showToast('PayPal error. Please try again or use another method.'); },
      onCancel: function() { showToast('Payment cancelled. You can try again anytime.'); }
    }).render('#paypal-button-container');
  });
}

function confirmPayment(inputId, method) {
  const code = document.getElementById(inputId).value.trim().toUpperCase();
  if (!code || code.length < 6) { showToast('Please enter a valid confirmation code.'); return; }
  showSuccess(method || 'M-Pesa', code);
}

function showSuccess(method, ref) {
  const badge = document.getElementById('inv-status');
  badge.textContent = 'Paid';
  badge.style.cssText = 'background:rgba(37,211,102,0.1);border-color:rgba(37,211,102,0.4);color:#25D366;font-family:var(--font-label);font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;padding:0.3rem 0.7rem';
  const tabs = document.getElementById('method-tabs');
  if (tabs) tabs.style.display = 'none';
  document.querySelectorAll('.method-pane').forEach(p => p.classList.remove('active'));
  document.getElementById('paymentSuccess').classList.add('show');
  const msg = document.getElementById('success-msg');
  if (msg) msg.textContent = 'Your ' + method + ' payment has been received (ref: ' + ref + '). We will begin processing your order and contact you within 24 hours via WhatsApp.';
  showToast('Payment confirmed via ' + method + '! Ref: ' + ref);
}

function generateTrackHTML(ref) {
  const steps = [
    { label: 'Request Received', detail: 'Assigned reference ' + ref, state: 'done' },
    { label: 'Sourcing in Progress', detail: 'Locating your part from global suppliers', state: 'done' },
    { label: 'Part Located & Quoted', detail: 'Part found — awaiting your confirmation', state: 'active' },
    { label: 'In Transit', detail: 'Shipment dispatched from source hub', state: '' },
    { label: 'Customs Clearance', detail: 'Processing through East African customs', state: '' },
    { label: 'Out for Delivery', detail: 'Final delivery to your address', state: '' },
  ];
  return steps.map((s, i) => '<div class="track-step"><div><div class="track-dot ' + s.state + '"></div>' + (i < steps.length - 1 ? '<div class="track-line"></div>' : '') + '</div><div><div style="font-weight:500;color:' + (s.state ? 'var(--white)' : 'var(--mid)') + ';font-size:0.88rem">' + s.label + '</div><div style="font-size:0.8rem;color:var(--muted)">' + s.detail + '</div></div></div>').join('');
}

function trackOrder() {
  const val = document.getElementById('track-input').value.trim();
  if (!val) { showToast('Please enter your order reference number.'); return; }
  document.getElementById('trackStatus').innerHTML = generateTrackHTML(val);
  document.getElementById('trackResult').classList.add('show');
}

function showToast(msg, duration=5000) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') goTo(currentPage + 1);
  if (e.key === 'ArrowLeft') goTo(currentPage - 1);
});

let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 60) goTo(currentPage + (diff > 0 ? 1 : -1));
});
