# node-red-nodes
Some useful nodes to use with node-red

Copyright (C) 2017 Erich Kitzmüller
License: LGPL V3, see https://www.gnu.org/licenses/lgpl

Interval-Timer: Provides an injection node with accurate timing, it fires in multiples of the given interval relative to Jan 1st 1970 00:00:00 UTC. The interval is in milliseconds, so it provides a higher resolution than the standard injector.

B-H-Protocol: Provides a node that can parse and compose telegrams in the Bayern-Hessen-Protocol (Bavaria-Hessia-Protocol) which is a standard for air pollution analyzers.

B-H-Simple: Provides a node that goes hand-in-hand with B-H-Protocol and makes using it easier for simple use cases; a numerical payload is translated to a MD telegram, and vice-versa.
