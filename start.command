#!/bin/bash

# ─── Gallery VR — Quick Start ───
# Finder에서 더블클릭하면 서버가 자동으로 시작됩니다.

# 이 파일이 위치한 디렉토리로 이동
cd "$(dirname "$0")"

echo ""
echo "🚀 File Gallery 시작 중..."
echo ""

# Node.js 확인
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "   https://nodejs.org 에서 설치해주세요."
    read -p "아무 키나 누르면 닫힙니다..."
    exit 1
fi

# node_modules 없으면 자동 설치
if [ ! -d "node_modules" ]; then
    echo "📦 패키지 설치 중..."
    npm install
    echo ""
fi

# 서버 시작 (포트 3005 — 다른 dev 서버와 충돌 방지)
PORT=3005 npm run dev
