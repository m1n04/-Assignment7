// === API 설정 ===
let apiKey = "";
let apiURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// === AI 응답 데이터 ===
let aiResponse = {
  noise_factor: null,
  misunderstood_result: null,
  solution_tip: null
};

// === 상태 변수 ===
let isCounting = false;
let analysisState = "idle"; // idle | loading | done

// === 타이핑 애니메이션 ===
let typingText = { noise: "", misread: "", tip: "" };
let typingTargets = { noise: "", misread: "", tip: "" };
let typingSpeed = 1; // 프레임당 추가될 글자 수

// === 입자 시스템 ===
let particles = [];
const NUM_PARTICLES = 80;
let noiseIntensity = 1.5;

// === 테마 사이버 펑크 / 다크 톤 팔레트 ===
const C = {
  bg:         [15, 12, 35],       // 딥 네이비
  panel1:    [30, 40, 80],       // 송신자 패널 (블루 계열)
  panel2:    [50, 20, 45],       // 노이즈 패널 (보라-레드 계열)
  panel3:    [20, 15, 50],       // 수신자 패널 (다크 블루)
  accent1:   [140, 190, 255],    // 아이스 블루 (나의 의도)
  accent2:   [255, 100, 160],    // 핑크 레드 (노이즈)
  accent3:   [255, 80, 80],      // 레드 (오해)
  tipGreen:  [80, 220, 150],     // 소통 팁
  white:     [255, 255, 255],
  gray:      [160, 160, 190],
  dimWhite:  [200, 200, 220]
};

// === HTML UI 요소 ===
let inputMessage, inputIntent, submitBtn;

// === 고정 레이아웃 가로세로 ===
let W = 1200;
let H = 720;
let panelW, panelH;
let inputAreaH = 160;
let solutionH = 80;

function setup() {
  // 화면 중앙 배치를 위한 기본 캔버스 생성
  createCanvas(W, H);
  textFont('sans-serif');
  
  panelW = (W - 60) / 3; // 20px 자잘한 간격 배정
  panelH = H - inputAreaH - solutionH - 60; // 상단 여백 보정

  // --- [수업 필수 가이드] API KEY 보안 예외 처리 ---
  if (typeof setAPIKey === "function") {
    setAPIKey();
  } else {
    apiKey = prompt("Gemini API Key를 입력하세요:");
  }

  // 입력창 및 버튼 UI 생성
  _createInputUI();

  // 입자 그래픽 초기화
  _initParticles();
}

function _createInputUI() {
  // --- 메시지 입력창 ---
  inputMessage = createInput('');
  inputMessage.size(260, 30);
  inputMessage.style('background', 'rgba(30,40,80,0.85)');
  inputMessage.style('color', '#a8c8ff');
  inputMessage.style('border', '1.5px solid rgba(140,190,255,0.5)');
  inputMessage.style('border-radius', '18px 18px 18px 4px');
  inputMessage.style('padding', '6px 16px');
  inputMessage.style('font-size', '13px');
  inputMessage.style('outline', 'none');
  inputMessage.attribute('placeholder', '연인에게 보낼 말 (예: 나 일찍 잘게)');

  // --- 속마음 입력창 ---
  inputIntent = createInput('');
  inputIntent.size(260, 30);
  inputIntent.style('background', 'rgba(30,40,80,0.85)');
  inputIntent.style('color', '#a8c8ff');
  inputIntent.style('border', '1.5px solid rgba(140,190,255,0.4)');
  inputIntent.style('border-radius', '18px 18px 18px 4px');
  inputIntent.style('padding', '6px 16px');
  inputIntent.style('font-size', '13px');
  inputIntent.style('outline', 'none');
  inputIntent.attribute('placeholder', '진짜 속마음 (예: 피곤해서 쉬고 싶음)');

  // --- 분석 버튼 ---
  submitBtn = createButton('✦ 노이즈 분석');
  submitBtn.style('background', 'linear-gradient(135deg, #ff6b9d, #c44eff)');
  submitBtn.style('color', '#fff');
  submitBtn.style('border', 'none');
  submitBtn.style('border-radius', '24px');
  submitBtn.style('padding', '10px 28px');
  submitBtn.style('font-size', '14px');
  submitBtn.style('font-weight', '700');
  submitBtn.style('cursor', 'pointer');
  submitBtn.style('letter-spacing', '1px');
  submitBtn.style('box-shadow', '0 4px 20px rgba(255,107,157,0.4)');
  submitBtn.mousePressed(askGemini);

  // 위치 조정 고정 호출
  _positionInputs();
}

// 브라우저 화면 안에서 p5 캔버스 상대값 좌표 절대 고정
function _positionInputs() {
  let canvasElement = e => e.position(
    canvas.getBoundingClientRect().left + 36, 
    canvas.getBoundingClientRect().top + panelH + 75
  );
  
  if (inputMessage && inputIntent && submitBtn) {
    inputMessage.position(canvas.getBoundingClientRect().left + 36, canvas.getBoundingClientRect().top + panelH + 75);
    inputIntent.position(canvas.getBoundingClientRect().left + 36, canvas.getBoundingClientRect().top + panelH + 115);
    submitBtn.position(canvas.getBoundingClientRect().left + 320, canvas.getBoundingClientRect().top + panelH + 90);
  }
}

function windowResized() {
  _positionInputs(); // 브라우저 크기 변해도 UI 입력창 위치 고정 보정
}

function _initParticles() {
  particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: random(panelW + 40, panelW * 2 + 20),
      y: random(120, panelH - 40),
      origX: 0, origY: 0,
      seed: random(1000),
      size: random(3, 7),
      col: random() < 0.4 ? C.accent2 : C.accent3,
      alpha: random(120, 220)
    });
    particles[i].origX = particles[i].x;
    particles[i].origY = particles[i].y;
  }
}

// =============================================
//  DRAW (p5 메인 루프)
// =============================================
function draw() {
  background(...C.bg);

  // 실시간 타이핑 애니메이션 업데이트 연동 처리
  _updateTyping();

  _drawPanels();
  _drawInputBubbles();
  _drawParticles();
  _drawPanelContent();
  _drawSolutionBar();
  _drawTitleBar();
}

// --- 타이틀 (최상단) ---
function _drawTitleBar() {
  noStroke();
  fill(...C.white, 220);
  textSize(15);
  textAlign(CENTER, TOP);
  textStyle(BOLD);
  text("우리는 왜 사랑하면서도 서로를 오해하는가?  ·  AI 해독과 처방", W / 2, 10);
  textStyle(NORMAL);
}

// --- 3분할 패널 배경 ---
function _drawPanels() {
  let y0 = 35;
  let gap = 20;

  // 패널 1: 나의 의도
  _drawPanel(20, y0, panelW, panelH, C.panel1, C.accent1, "💬  나의 의도", "Sender");
  // 패널 2: 노이즈
  _drawPanel(20 + panelW + gap, y0, panelW, panelH, C.panel2, C.accent2, "⚡  소통의 노이즈", "Noise Filter");
  // 패널 3: 오해
  _drawPanel(20 + (panelW + gap) * 2, y0, panelW, panelH, C.panel3, C.accent3, "💔  왜곡된 해독", "Receiver");
}

function _drawPanel(x, y, w, h, bg, accent, title, subtitle) {
  noStroke();
  fill(...bg, 190);
  rect(x, y, w, h, 14);

  // 상단 컬러 포인트 라인
  fill(...accent, 200);
  rect(x, y, w, 4, 14, 14, 0, 0);

  // 타이틀 텍스트
  fill(...accent, 240);
  textSize(15);
  textAlign(LEFT, TOP);
  textStyle(BOLD);
  text(title, x + 20, y + 20);
  textStyle(NORMAL);

  fill(...accent, 120);
  textSize(11);
  text(subtitle, x + 20, y + 42);

  // 부드러운 분할선
  stroke(...accent, 40);
  strokeWeight(1);
  line(x + 15, y + 60, x + w - 15, y + 60);
  noStroke();
}

// --- 하단 왼쪽 말풍선 UI 가이드 패널 ---
function _drawInputBubbles() {
  let y0 = 35;
  let bubbleY = panelH + y0 + 10;
  let x = 20;
  let w = panelW;

  fill(30, 40, 80, 220);
  stroke(140, 190, 255, 50);
  strokeWeight(1.5);
  rect(x, bubbleY, w, inputAreaH - 15, 12, 12, 12, 3);

  // 말풍선 디자인용 삼각형 꼬리
  noStroke();
  fill(30, 40, 80, 220);
  triangle(
    x + 20, bubbleY + inputAreaH - 15,
    x + 38, bubbleY + inputAreaH - 15,
    x + 24, bubbleY + inputAreaH - 2
  );
}

// --- 입자 렌더링 및 모션 노이즈 처리 ---
function _drawParticles() {
  if (isCounting) {
    noiseIntensity = lerp(noiseIntensity, 45, 0.08); // 로딩 시 격렬한 무작위 확산
  } else if (analysisState === "done") {
    noiseIntensity = lerp(noiseIntensity, 3, 0.04);  // 결과 나오면 차분히 뭉침
  } else {
    noiseIntensity = lerp(noiseIntensity, 1.5, 0.05); // 대기 기본 진동
  }

  for (let p of particles) {
    let t = frameCount * 0.02 + p.seed;
    let ox = (noise(t) - 0.5) * noiseIntensity * 12;
    let oy = (noise(t + 70) - 0.5) * noiseIntensity * 12;

    let cx = p.origX + ox;
    let cy = p.origY + oy;

    // 분석중 애니메이션: 오른쪽 3영역 패널로 파동이 휩쓸려가는 무브먼트 추가
    if (isCounting) {
      let drift = sin(frameCount * 0.1 + p.seed) * 80;
      cx += drift;
    }

    let a = p.alpha + sin(frameCount * 0.05 + p.seed) * 25;
    a = constrain(a, 50, 240);

    noStroke();
    fill(...p.col, a);
    ellipse(cx, cy, p.size);
  }
}

// --- 패널별 AI 데이터 실시간 출력 ---
function _drawPanelContent() {
  let gap = 20;
  let y0 = 35;
  let textY = y0 + 75;
  let w = panelW;

  let msgVal = inputMessage ? inputMessage.value() : "";
  let intVal = inputIntent ? inputIntent.value() : "";

  textAlign(LEFT, TOP);
  
  // ================= [ 패널 1 ] 나의 의도 렌더링 =================
  fill(...C.accent1, 200);
  textStyle(BOLD); textSize(13);
  text("보낼 대사", 20 + 20, textY);
  textStyle(NORMAL);
  
  fill(...C.dimWhite, 220);
  textSize(13); textLeading(20);
  text(msgVal.length > 0 ? "\"" + msgVal + "\"" : "입력창에 문장을 적어주세요.", 20 + 20, textY + 22, w - 40);

  fill(...C.accent1, 160);
  textStyle(BOLD);
  text("진짜 속마음", 20 + 20, textY + 95);
  textStyle(NORMAL);
  
  fill(...C.gray, 200);
  textSize(12);
  text(intVal.length > 0 ? "\"" + intVal + "\"" : "진짜 전하고 싶었던 숨은 감정은?", 20 + 20, textY + 117, w - 40);

  // 하단 상태 메세지 가이드 바
  let stateMsg = "";
  if (analysisState === "idle") stateMsg = "데이터를 기입하고 ✦ 버튼을 클릭하세요.";
  else if (analysisState === "loading") stateMsg = "⚡ AI 분석 중... 노이즈 해독 단계...";
  else stateMsg = "✓ 오해 매핑 분석 완료";

  fill(...C.accent1, analysisState === "loading" ? 160 + sin(frameCount * 0.2) * 60 : 120);
  textSize(11);
  textAlign(CENTER, BOTTOM);
  text(stateMsg, 20 + w / 2, y0 + panelH - 15);

  // ================= [ 패널 2 ] 소통 노이즈 출력 =================
  let p2x = 20 + w + gap;
  textAlign(LEFT, TOP);

  if (analysisState === "idle") {
    fill(...C.gray, 100);
    textSize(13);
    text("커뮤니케이션 왜곡을 유발하는\n트라우마, 환경적 노이즈 원인이\n이곳에 파싱됩니다.", p2x + 20, textY, w - 40);
  } else {
    fill(...C.accent2, 220);
    textSize(13); textLeading(21);
    text(typingText.noise || "신호 대기 중...", p2x + 20, textY, w - 40);
  }

  // ================= [ 패널 3 ] 왜곡된 오해 해석 출력 =================
  let p3x = 20 + (w + gap) * 2;
  textAlign(LEFT, TOP);

  if (analysisState === "idle") {
    fill(...C.gray, 100);
    textSize(13);
    text("상대방의 오해 필터가 반영된\n차가운 수신 메시지가\n여기에 출력됩니다.", p3x + 20, textY, w - 40);
  } else {
    fill(...C.accent3, 240);
    textSize(14); textStyle(BOLD); textLeading(22);
    text(typingText.misread || "", p3x + 20, textY, w - 40);
    textStyle(NORMAL);
  }
}

// --- 하단 처방전 솔루션 바 디자인 ---
function _drawSolutionBar() {
  let y = H - solutionH - 15;
  let bw = W - 40;

  fill(15, 45, 35, 230);
  stroke(...C.tipGreen, 50);
  strokeWeight(1.2);
  rect(20, y, bw, solutionH, 10);
  noStroke();

  fill(...C.tipGreen, 220);
  textSize(12);
  textAlign(LEFT, CENTER);
  textStyle(BOLD);
  text("💊  Devito 커뮤니케이션 해결 처방 소통 팁", 40, y + 22);
  textStyle(NORMAL);

  fill(...C.white, analysisState === "done" ? 210 : 100);
  textSize(13); textLeading(20);
  let tipContent = analysisState === "idle"
    ? "분석을 실행하면 불통의 고리를 끊어낼 실용적이고 따뜻한 교정 솔루션 문장이 제공됩니다."
    : (typingText.tip || "처방 문장 생성 중...");
  text(tipContent, 40, y + 48, bw - 60);
}

// === 실시간 매 프레임 글자를 채워주는 타이핑 엔진 ===
function _updateTyping() {
  if (analysisState !== "done") return;

  ["noise", "misread", "tip"].forEach(key => {
    let targetText = typingTargets[key];
    if (typingText[key].length < targetText.length) {
      // 프레임당 글자 추가 수 증가 연산
      typingText[key] = targetText.substring(0, typingText[key].length + typingSpeed);
    }
  });
}

// =============================================
//  GEMINI 구조화된 JSON API 통신 모듈
// =============================================
async function askGemini() {
  if (!apiKey) {
    alert("API Key 가 유출 차단 상태입니다. 새로고침 후 입력해주세요.");
    return;
  }
  if (!inputMessage.value() || !inputIntent.value()) {
    alert("보낼 대사와 마음속 진짜 의도를 둘 다 정교하게 채워주세요!");
    return;
  }

  isCounting = true;
  analysisState = "loading";
  
  // 문자열 버퍼 변수 리셋
  typingText = { noise: "", misread: "", tip: "" };
  typingTargets = { noise: "", misread: "", tip: "" };

  let userPrompt = `[유저의 대사]: "${inputMessage.value()}"\n[유저의 본래 의도]: "${inputIntent.value()}"`;

  let systemPrompt = `너는 커뮤니케이션 불통 및 왜곡 이론(Devito, 1997)에 정통한 연애 심리 커뮤니케이션 전문가야.
주어진 대사와 의도를 바탕으로 다음 규칙에 맞춰 분석해줘:
1. noise_factor: 텍스트 메시지의 한계, 연인의 심리적 불안감 등 소통 노이즈 요인을 2~3문장으로 구체적으로 진단해줘.
2. misunderstood_result: 상대방이 가장 서운하게 오해할 수 있는 해석 문장을 감정적으로 표현해줘 (1~2문장, 상대방이 머릿속으로 하는 생각 독백 형식).
3. solution_tip: 오해를 방지하기 위해 표현을 어떻게 고치거나 어떤 다정한 문장을 추가해야 할지 실용적인 대안 팁을 2문장으로 제안해줘.
반드시 제공하는 한국어 JSON 스키마 규격체계에 맞추어 답변을 정량 출력해야 해.`;

  let jsonSchema = {
    type: "OBJECT",
    properties: {
      noise_factor:         { type: "STRING" },
      misunderstood_result: { type: "STRING" },
      solution_tip:         { type: "STRING" }
    },
    required: ["noise_factor", "misunderstood_result", "solution_tip"]
  };

  let requestBody = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: jsonSchema
    }
  };

  try {
    let res = await fetch(`${apiURL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    
    if (!res.ok) throw new Error("API 연동 에러 상태코드: " + res.status);
    
    let data = await res.json();
    let parsed = JSON.parse(data.candidates[0].content.parts[0].text);

    aiResponse = parsed;
    
    // 타이핑 대상 목표 문자열 버퍼에 저장
    typingTargets.noise  = parsed.noise_factor || "";
    typingTargets.misread = parsed.misunderstood_result || "";
    typingTargets.tip    = parsed.solution_tip || "";
    
    analysisState = "done";

  } catch (err) {
    console.error("Gemini 분석 런타임 오류:", err);
    typingTargets.noise   = "분석 연산 실패: API Key 제한 또는 네트워크 문제 사유가 감지됩니다.";
    typingTargets.misread = "데이터 해독 불가 상태";
    typingTargets.tip     = "입력 정보 확인 후 리트라이를 진행하세요.";
    typingText = { ...typingTargets };
    analysisState = "done";
  } finally {
    isCounting = false;
  }
}