# The public docket

Every ruling the Chainlink CRE workflow files to `CourtRecord` on Sepolia
([0xbcA0…6B3](https://sepolia.etherscan.io/address/0xbcA0a8c279B1dfDD5cC6640dA7eA22CeaeAE26B3)) is
recorded here. The court convenes on its own every three hours
([`scripts/docket.mjs`](../scripts/docket.mjs)).

- `transcripts/<hash>.json`: the full transcript behind each on-chain hash, covering the exhibits,
  both counsel's arguments, the ruling and the sentencing worksheet. Its keccak256 over the canonical
  JSON equals the `transcriptHash` filed on-chain.
- `runs/case-<n>.log`: the CRE CLI log of the run that filed case `n`.
- `index.json`: the hashes on file, read by the hosted courtroom.

Commits here are made by the scheduler. To verify a ruling, open it in the
[courtroom](https://bull-v-bear.onrender.com), which recomputes the hash in your browser and compares
it with the chain.
