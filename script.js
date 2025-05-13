// Google Apps Script 웹앱 URL
const SCRIPT_URL = 'https://script.google.com/macros/s/WEB_APP_ID/exec';

// 중복 확인용 GET (doGet 구현 필요)
async function fetchExistingBookings(slotStr) {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=list&time=${slotStr}`, { method: 'GET', mode: 'cors' });
    if (!res.ok) throw new Error(`GET 오류: ${res.status}`);
    const data = await res.json();
    return data.bookings || [];
  } catch (err) {
    console.error('예약 조회 오류:', err);
    return [];
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const walkInInput = document.getElementById('walkInTime');
  const roomInput = document.getElementById('roomSize');
  const difficultyInput = document.getElementById('difficulty');
  const roomButtons = document.querySelectorAll('.room-buttons button');
  const difficultyButtons = document.querySelectorAll('.difficulty-buttons button');
  const form = document.getElementById('reservationForm');
  const resultDiv = document.getElementById('result');

  // 버튼 클릭으로 값 설정
  roomButtons.forEach(btn => btn.addEventListener('click', async () => {
    const slotStr = computeSlot();
    // 중복 체크
    const bookings = await fetchExistingBookings(slotStr);
    const conflict = bookings.some(b => b.walkInTime === slotStr && b.roomSize === btn.dataset.value);
    if (conflict) {
      alert('이미 예약된 방입니다. 다른 방을 선택해주세요.');
      return;
    }
    roomButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    roomInput.value = btn.dataset.value;
  }));

  difficultyButtons.forEach(btn => btn.addEventListener('click', () => {
    difficultyButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    difficultyInput.value = btn.dataset.value;
  }));

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    if (!confirm('입력한 정보가 맞습니까?')) {
      submitBtn.disabled = false;
      return;
    }

    // 필수 검사
    const teamName = form.teamName.value.trim();
    const adult = Number(form.adultCount.value);
    const youth = Number(form.youthCount.value);
    if (!teamName) {
      alert('팀명을 입력해주세요.');
      submitBtn.disabled = false;
      return;
    }
    if (adult + youth <= 0) {
      alert('인원 수를 입력해주세요.');
      submitBtn.disabled = false;
      return;
    }

    // 슬롯 계산 및 설정
    const slotStr = computeSlot();
    walkInInput.value = slotStr;

    // payload
    const payload = {
      walkInTime: slotStr,
      roomSize: roomInput.value,
      teamName,
      difficulty: difficultyInput.value,
      totalCount: adult + youth,
      youthCount: youth,
      vehicle: form.vehicle.value.trim() || ''
    };

    // 전송 시작
    resultDiv.textContent = '전송 중...';
    const sendPromise = fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });

    // 결제 안내
    const adultAmount = adult * 7000;
    const youthAmount = youth * 5000;
    const totalAmount = adultAmount + youthAmount;
    resultDiv.innerHTML =
      `결제 금액 안내<br>` +
      `<strong style="font-size:1.2em; color:#d32f2f;">총 금액 = ${totalAmount.toLocaleString()}원</strong><br>` +
      `성인 ${adult}명 × 7,000원 = ${adultAmount.toLocaleString()}원<br>` +
      `청소년 ${youth}명 × 5,000원 = ${youthAmount.toLocaleString()}원<br>`;

    // 전송 완료 후
    sendPromise.then(() => {
      resultDiv.innerHTML = '';
      submitBtn.disabled = false;
      form.reset();
      roomButtons.forEach(b => b.classList.remove('selected'));
      difficultyButtons.forEach(b => b.classList.remove('selected'));
    });
  });

  // 현재 시간으로 슬롯 계산
  function computeSlot() {
    const now = new Date();
    let h = now.getHours();
    const m = now.getMinutes();
    const slots = [0, 20, 40];
    let chosen = slots.find(s => m <= s + 3);
    if (chosen === undefined) { h = (h + 1) % 24; chosen = 0; }
    return `${String(h).padStart(2,'0')}:${String(chosen).padStart(2,'0')}`;
  }
});
