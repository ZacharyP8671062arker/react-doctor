
We're working on v2 of React Doctor (in @packages/react-doctor-v2). We want to ensure parity, of everything. 

run these:
`node packages/react-doctor-v2/bin/react-doctor.js /Users/rasmus/dev/ami-2`  (v2)
`node packages/react-doctor/bin/react-doctor.js /Users/rasmus/dev/ami-2`  (v1)

the output should match in style, and scores more or less (except for intended changes / improvements in v2)

(v1 has an interactive prompt, which you might have to disable, but remember to enable it once you confirm parity.)
