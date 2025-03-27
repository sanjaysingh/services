-- Create todos table
CREATE TABLE todos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Create policies
-- Policy for selecting todos (users can only see their own todos)
CREATE POLICY "Users can view their own todos"
    ON todos FOR SELECT
    USING (auth.uid() = user_id);

-- Policy for inserting todos (users can only insert their own todos)
CREATE POLICY "Users can insert their own todos"
    ON todos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy for updating todos (users can only update their own todos)
CREATE POLICY "Users can update their own todos"
    ON todos FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy for deleting todos (users can only delete their own todos)
CREATE POLICY "Users can delete their own todos"
    ON todos FOR DELETE
    USING (auth.uid() = user_id);

-- First, create a function to set the user_id
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Then create a trigger that runs before insert
CREATE TRIGGER set_user_id_trigger
    BEFORE INSERT ON todos
    FOR EACH ROW
    EXECUTE FUNCTION set_user_id();