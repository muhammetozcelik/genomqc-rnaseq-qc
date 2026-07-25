.PHONY: test example clean

test:
	python -m unittest discover -s tests -p 'test_*.py' -v
	bash -n bin/genomqc tests/test_cli.sh
	bash tests/test_cli.sh
	python src/validate_fastq_pairs.py \
		examples/data/demo_R1.fastq \
		examples/data/demo_R2.fastq

example:
	./bin/genomqc \
		--r1 examples/data/demo_R1.fastq \
		--r2 examples/data/demo_R2.fastq \
		--sample demo \
		--output results/demo

clean:
	rm -rf results test-output

