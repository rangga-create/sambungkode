CREATE TABLE questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  language VARCHAR(40) NOT NULL,
  difficulty ENUM('Easy', 'Medium', 'Hard') NOT NULL DEFAULT 'Easy',
  points INT NOT NULL DEFAULT 10,
  analogy TEXT NOT NULL,
  code_template TEXT NOT NULL,
  hint VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE question_answers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text VARCHAR(255) NOT NULL,
  is_case_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_qa_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
    ON DELETE CASCADE
);

CREATE TABLE contest_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  duration_seconds INT NOT NULL DEFAULT 900,
  status ENUM('DRAFT', 'ACTIVE', 'FINISHED') NOT NULL DEFAULT 'DRAFT',
  started_at DATETIME NULL,
  ended_at DATETIME NULL
);

CREATE TABLE session_questions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  custom_points INT NULL,
  CONSTRAINT fk_sq_session
    FOREIGN KEY (session_id) REFERENCES contest_sessions(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sq_question
    FOREIGN KEY (question_id) REFERENCES questions(id),
  CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

CREATE TABLE participants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(80) NOT NULL,
  email VARCHAR(120) NULL UNIQUE,
  role ENUM('PARTICIPANT', 'ADMIN') NOT NULL DEFAULT 'PARTICIPANT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session_scores (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  participant_id BIGINT UNSIGNED NOT NULL,
  total_score INT NOT NULL DEFAULT 0,
  solved_count INT NOT NULL DEFAULT 0,
  total_time_seconds INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ss_session
    FOREIGN KEY (session_id) REFERENCES contest_sessions(id),
  CONSTRAINT fk_ss_participant
    FOREIGN KEY (participant_id) REFERENCES participants(id),
  CONSTRAINT uq_session_participant UNIQUE (session_id, participant_id)
);

CREATE TABLE submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  participant_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  earned_points INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sub_session
    FOREIGN KEY (session_id) REFERENCES contest_sessions(id),
  CONSTRAINT fk_sub_participant
    FOREIGN KEY (participant_id) REFERENCES participants(id),
  CONSTRAINT fk_sub_question
    FOREIGN KEY (question_id) REFERENCES questions(id)
);