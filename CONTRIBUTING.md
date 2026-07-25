# Contributing

Bug reports and focused improvements are welcome.

1. Open an issue describing the problem or proposed change.
2. Create a branch from `main`.
3. Add or update tests for behavioral changes.
4. Run the local checks:

   ```bash
   python -m unittest discover -s tests -p 'test_*.py' -v
   bash -n bin/genomqc tests/test_cli.sh
   bash tests/test_cli.sh
   ```

5. Submit a pull request with the rationale, validation performed and expected
   user impact.

Please do not commit identifiable participant data, controlled-access sequence
data or credentials.

