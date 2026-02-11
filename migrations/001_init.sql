CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    image_url TEXT NOT NULL,
    extracted_numbers JSONB NOT NULL DEFAULT '[]',
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);

CREATE TABLE IF NOT EXISTS lottery_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    region TEXT NOT NULL,
    prize_type TEXT NOT NULL,
    winning_number TEXT NOT NULL
);

CREATE INDEX idx_lottery_results_winning_number ON lottery_results(winning_number);
CREATE INDEX idx_lottery_results_date ON lottery_results(date DESC);
