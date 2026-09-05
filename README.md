@"
# Peppermint Robotics — Fleet Management Dashboard

SDE-1 Hiring Challenge — Assignment 1 (Frontend)

## Overview

A fleet management dashboard for monitoring eight robots using the provided synthetic fleet data.

The dashboard supports:

- Recorded 15-minute event replay from `events.jsonl`
- Replay controls with Play, Pause, Reset and 1x/2x/5x/10x speed
- Simulated live fleet feed with continuous movement, battery changes and status transitions
- Fleet-level active robot trend over time
- Search by robot ID, type or status
- Filtering by Working, Attention, Charging and Offline
- Individual robot details including status, battery and position
- Responsive operator-oriented dashboard UI

## Tech Stack

- React
- Vite
- Recharts
- JavaScript

## Running locally

```bash
cd frontend
npm install
npm run dev
## Live Demo

[Open the deployed Fleet Management Dashboard](peppermint-sde1-fleet-dashboard.vercel.app)

## Live Demo

[Open the deployed Fleet Management Dashboard](https://peppermint-sde1-fleet-dashboard.vercel.app)
