/* ============================================================
   booking.js
   The 3-step booking modal: pick a date + batch, pick a
   speaker/track, review the summary, and confirm the booking.
   ============================================================ */

function openSlotModal(sid) {
  if (!currentUser) { showToast('Please log in to view seats'); showLogin('login'); return; }

  selectedService = SERVICES.find(s => s.id === sid);
  slotData = generateSlots(sid);
  selectedDay = 0;
  selectedSlot = null;
  selectedTherapist = null;

  document.getElementById('modal-title').textContent = selectedService.name;
  document.getElementById('modal-meta').textContent =
    selectedService.duration + ' · ' + selectedService.format + ' · From ' +
    (selectedService.price === 0 ? 'Free' : '₹' + selectedService.price.toLocaleString());

  renderDateTabs();
  renderSlots();
  updateStepUI(1);

  document.getElementById('slot-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSlotModal() {
  document.getElementById('slot-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderDateTabs() {
  document.getElementById('date-tabs').innerHTML = slotData.map((d, i) => `
    <div class="date-tab ${i === selectedDay ? 'active' : ''}" onclick="selectDay(${i})">
      <div class="dt-day">${d.label}</div><div class="dt-num">${d.num}</div><div class="dt-avail">${d.avail} free</div>
    </div>`).join('');
}

function selectDay(i) {
  selectedDay = i;
  selectedSlot = null;
  renderDateTabs();
  renderSlots();
  setBtn('btn-step2', false);
}

function renderSlots() {
  document.getElementById('slots-grid').innerHTML = slotData[selectedDay].slots.map((s, i) => `
    <div class="slot ${s.booked ? 'booked' : ''} ${selectedSlot === i && !s.booked ? 'selected' : ''}" onclick="${s.booked ? '' : 'selectSlot(' + i + ')'}">
      <div class="sl-time">${s.time}</div><div class="sl-price">${s.price === 0 ? 'Free' : '₹' + s.price.toLocaleString()}</div>
      <div class="sl-status">${s.booked ? 'Full' : s.fillingFast ? 'Filling Fast ↑' : 'Available'}</div>
    </div>`).join('');
}

function selectSlot(i) {
  selectedSlot = i;
  renderSlots();
  setBtn('btn-step2', true);
}

function renderTherapists() {
  const rel = THERAPISTS.filter(t => t.specialties.includes(selectedService.name));
  const list = rel.length > 0 ? rel : THERAPISTS;

  document.getElementById('therapist-options').innerHTML = list.map(t => `
    <div class="t-option ${selectedTherapist === t.id ? 'selected' : ''}" onclick="selectTherapist(${t.id})">
      <div class="t-avatar ${t.avatar}">${t.emoji}</div>
      <div class="t-name">${t.name}</div><div class="t-role">${t.role}</div><div class="t-rating">★ ${t.rating}</div>
    </div>`).join('');
}

function selectTherapist(id) {
  selectedTherapist = id;
  renderTherapists();
  setBtn('btn-step3', true);
}

function setBtn(id, on) {
  const b = document.getElementById(id);
  b.disabled = !on;
  b.style.opacity = on ? '1' : '0.4';
  b.style.cursor = on ? 'pointer' : 'not-allowed';
}

function goToStep(s) {
  if (s === 2) renderTherapists();
  if (s === 3) renderSummary();
  updateStepUI(s);
}

function updateStepUI(s) {
  document.getElementById('step-slot').style.display = s === 1 ? 'block' : 'none';
  document.getElementById('step-therapist').style.display = s === 2 ? 'block' : 'none';
  document.getElementById('step-confirm').style.display = s === 3 ? 'block' : 'none';
  for (let i = 1; i <= 3; i++) {
    document.getElementById('bstep-' + i).className = 'step-item' + (i < s ? ' done' : i === s ? ' current' : '');
  }
}

function renderSummary() {
  const sl = slotData[selectedDay].slots[selectedSlot];
  const th = THERAPISTS.find(t => t.id === selectedTherapist);
  const fee = sl.price === 0 ? 0 : Math.round(sl.price * 0.05);
  const total = sl.price + fee;

  document.getElementById('summary-rows').innerHTML = `
    <div class="summary-row"><span class="sr-label">Event</span><span class="sr-value">${selectedService.name}</span></div>
    <div class="summary-row"><span class="sr-label">Duration</span><span class="sr-value">${selectedService.duration}</span></div>
    <div class="summary-row"><span class="sr-label">Date</span><span class="sr-value">${slotData[selectedDay].date}</span></div>
    <div class="summary-row"><span class="sr-label">Batch</span><span class="sr-value">${sl.time}</span></div>
    <div class="summary-row"><span class="sr-label">Speaker / Track</span><span class="sr-value">${th.name}</span></div>
    <div class="summary-row"><span class="sr-label">Ticket Price</span><span class="sr-value">${sl.price === 0 ? 'Free' : '₹' + sl.price.toLocaleString()}</span></div>
    <div class="summary-row"><span class="sr-label">Convenience Fee (5%)</span><span class="sr-value">₹${fee.toLocaleString()}</span></div>
    <div class="summary-row summary-total"><span class="sr-label">Total Payable</span><span class="sr-value">₹${total.toLocaleString()}</span></div>`;
}

function finalConfirm() {
  const sl = slotData[selectedDay].slots[selectedSlot];
  const th = THERAPISTS.find(t => t.id === selectedTherapist);
  const fee = sl.price === 0 ? 0 : Math.round(sl.price * 0.05);
  const total = sl.price + fee;

  const bk = {
    id: 'JCN' + Date.now(),
    service: selectedService.name,
    emoji: selectedService.emoji,
    date: slotData[selectedDay].date,
    time: sl.time,
    therapist: th.name,
    duration: selectedService.duration,
    price: total,
    status: 'upcoming',
    notes: document.getElementById('special-notes').value
  };

  userBookings.unshift(bk);
  closeSlotModal();

  document.getElementById('confirm-detail').innerHTML = `
    <div class="confirm-detail-row"><span class="cd-l">Ticket ID</span><span class="cd-v">${bk.id}</span></div>
    <div class="confirm-detail-row"><span class="cd-l">Event</span><span class="cd-v">${bk.service}</span></div>
    <div class="confirm-detail-row"><span class="cd-l">Date & Time</span><span class="cd-v">${bk.date} · ${bk.time}</span></div>
    <div class="confirm-detail-row"><span class="cd-l">Speaker</span><span class="cd-v">${bk.therapist}</span></div>
    <div class="confirm-detail-row"><span class="cd-l">Total Paid</span><span class="cd-v">₹${bk.price.toLocaleString()}</span></div>`;

  document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-modal').classList.remove('open');
}