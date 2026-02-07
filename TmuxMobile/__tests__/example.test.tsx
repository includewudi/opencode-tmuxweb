describe('Example Test Suite', () => {
  test('basic jest config works', () => {
    expect(true).toBe(true);
  });

  test('arithmetic operations work', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });

  test('string operations work', () => {
    const greeting = 'Hello Jest';
    expect(greeting).toContain('Jest');
  });
});
