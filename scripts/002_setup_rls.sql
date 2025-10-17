-- Enable Row Level Security on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Sessions: Allow anyone to read and insert (no auth required for this app)
CREATE POLICY "Allow public read access to sessions" ON sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to sessions" ON sessions FOR UPDATE USING (true);

-- Teams: Allow public access
CREATE POLICY "Allow public read access to teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to teams" ON teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to teams" ON teams FOR UPDATE USING (true);

-- Participants: Allow public access
CREATE POLICY "Allow public read access to participants" ON participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to participants" ON participants FOR UPDATE USING (true);

-- Messages: Allow public access
CREATE POLICY "Allow public read access to messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to messages" ON messages FOR INSERT WITH CHECK (true);

-- Answers: Allow public access
CREATE POLICY "Allow public read access to answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access to answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access to answers" ON answers FOR UPDATE USING (true);
