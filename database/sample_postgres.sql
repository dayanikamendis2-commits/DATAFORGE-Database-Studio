-- Optional disposable test database schema for DATAFORGE
CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT REFERENCES departments(id),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(180),
  joined_on DATE,
  salary NUMERIC(12,2),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO departments(name) VALUES ('Engineering'), ('Operations')
ON CONFLICT DO NOTHING;
INSERT INTO employees(department_id, full_name, email, joined_on, salary)
SELECT 1, 'Sample User', 'sample@example.com', CURRENT_DATE, 85000.00
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE email = 'sample@example.com');