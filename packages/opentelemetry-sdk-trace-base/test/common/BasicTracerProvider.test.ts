/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  context,
  trace,
  SpanContext,
  TraceFlags,
  ROOT_CONTEXT,
  TextMapPropagator,
  TextMapSetter,
  Context,
  TextMapGetter,
  propagation,
  diag,
} from '@opentelemetry/api';
import { CompositePropagator } from '@opentelemetry/core';
import { TraceState, W3CTraceContextPropagator } from '@opentelemetry/core';
import { Resource } from '@opentelemetry/resources';
import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  BasicTracerProvider,
  NoopSpanProcessor,
  Span,
  AlwaysOnSampler,
  AlwaysOffSampler,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '../../src';
import { SpanImpl } from '../../src/Span';
import { MultiSpanProcessor } from '../../src/MultiSpanProcessor';

class DummyPropagator implements TextMapPropagator {
  inject(context: Context, carrier: any, setter: TextMapSetter<any>): void {
    throw new Error('Method not implemented.');
  }
  extract(context: Context, carrier: any, getter: TextMapGetter<any>): Context {
    throw new Error('Method not implemented.');
  }
  fields(): string[] {
    throw new Error('Method not implemented.');
  }
}

describe('BasicTracerProvider', () => {
  let envSource: Record<string, any>;
  let setGlobalPropagatorStub: sinon.SinonSpy<[TextMapPropagator], boolean>;

  if (global.process?.versions?.node === undefined) {
    envSource = globalThis as unknown as Record<string, any>;
  } else {
    envSource = process.env as Record<string, any>;
  }

  beforeEach(() => {
    // to avoid actually registering the TraceProvider and leaking env to other tests
    sinon.stub(trace, 'setGlobalTracerProvider');
    setGlobalPropagatorStub = sinon.spy(propagation, 'setGlobalPropagator');

    context.disable();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    describe('when options not defined', () => {
      it('should construct an instance', () => {
        const tracer = new BasicTracerProvider();
        assert.ok(tracer instanceof BasicTracerProvider);
      });

      it('should use empty span processor by default', () => {
        const errorStub = sinon.spy(diag, 'error');
        const tracer = new BasicTracerProvider();

        assert.ok(tracer['_activeSpanProcessor'] instanceof MultiSpanProcessor);
        assert.strictEqual(
          tracer['_activeSpanProcessor']['_spanProcessors'].length,
          0
        );
        sinon.assert.notCalled(errorStub);
      });
    });

    describe('when user sets span processors', () => {
      it('should use the span processors defined in the config', () => {
        const traceExporter = new ConsoleSpanExporter();
        const spanProcessor = new SimpleSpanProcessor(traceExporter);
        const tracer = new BasicTracerProvider({
          spanProcessors: [spanProcessor],
        });

        assert.ok(tracer['_activeSpanProcessor'] instanceof MultiSpanProcessor);
        assert.ok(
          tracer['_activeSpanProcessor']['_spanProcessors'].length === 1
        );
        assert.ok(
          tracer['_activeSpanProcessor']['_spanProcessors'][0] instanceof
            SimpleSpanProcessor
        );
        assert.ok(
          tracer['_activeSpanProcessor']['_spanProcessors'][0][
            '_exporter'
          ] instanceof ConsoleSpanExporter
        );
      });
    });

    describe('when "sampler" option defined', () => {
      it('should have an instance with sampler', () => {
        const tracer = new BasicTracerProvider({
          sampler: new AlwaysOnSampler(),
        });
        assert.ok(tracer instanceof BasicTracerProvider);
      });
    });

    describe('generalLimits', () => {
      describe('when not defined default values', () => {
        it('should have tracer with default values', () => {
          const tracer = new BasicTracerProvider({}).getTracer('default');
          assert.deepStrictEqual(tracer.getGeneralLimits(), {
            attributeValueLengthLimit: Infinity,
            attributeCountLimit: 128,
          });
        });
      });

      describe('when "attributeCountLimit" is defined', () => {
        it('should have tracer with defined value', () => {
          const tracer = new BasicTracerProvider({
            generalLimits: {
              attributeCountLimit: 100,
            },
          }).getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeCountLimit, 100);
        });
      });

      describe('when "attributeValueLengthLimit" is defined', () => {
        it('should have tracer with defined value', () => {
          const tracer = new BasicTracerProvider({
            generalLimits: {
              attributeValueLengthLimit: 10,
            },
          }).getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, 10);
        });

        it('should have tracer with negative "attributeValueLengthLimit" value', () => {
          const tracer = new BasicTracerProvider({
            generalLimits: {
              attributeValueLengthLimit: -10,
            },
          }).getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, -10);
        });
      });
    });

    describe('spanLimits', () => {
      describe('when not defined default values', () => {
        it('should have tracer with default values', () => {
          const tracer = new BasicTracerProvider({}).getTracer('default');
          assert.deepStrictEqual(tracer.getSpanLimits(), {
            attributeValueLengthLimit: Infinity,
            attributeCountLimit: 128,
            eventCountLimit: 128,
            linkCountLimit: 128,
            attributePerEventCountLimit: 128,
            attributePerLinkCountLimit: 128,
          });
        });
      });

      describe('when "attributeCountLimit" is defined', () => {
        it('should have tracer with defined value', () => {
          const tracer = new BasicTracerProvider({
            spanLimits: {
              attributeCountLimit: 100,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.attributeCountLimit, 100);
        });
      });

      describe('when "attributeValueLengthLimit" is defined', () => {
        it('should have tracer with defined value', () => {
          const tracer = new BasicTracerProvider({
            spanLimits: {
              attributeValueLengthLimit: 10,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.attributeValueLengthLimit, 10);
        });

        it('should have tracer with negative "attributeValueLengthLimit" value', () => {
          const tracer = new BasicTracerProvider({
            spanLimits: {
              attributeValueLengthLimit: -10,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.attributeValueLengthLimit, -10);
        });
      });

      describe('when attribute value length limit is defined via env', () => {
        it('should have general attribute value length limits value as defined with env', () => {
          envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '115';
          const tracer = new BasicTracerProvider().getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, 115);
          delete envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT;
        });
        it('should have span attribute value length limit value same as general limit value', () => {
          envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '125';
          const tracer = new BasicTracerProvider().getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, 125);
          assert.strictEqual(spanLimits.attributeValueLengthLimit, 125);
          delete envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT;
        });
        it('should have span and general attribute value length limits as defined in env', () => {
          envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '125';
          envSource.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = '109';
          const tracer = new BasicTracerProvider().getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, 125);
          assert.strictEqual(spanLimits.attributeValueLengthLimit, 109);
          delete envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT;
          delete envSource.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT;
        });
        it('should have span attribute value length limit as default of Infinity', () => {
          envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT = '125';
          envSource.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT = 'Infinity';
          const tracer = new BasicTracerProvider().getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, 125);
          assert.strictEqual(spanLimits.attributeValueLengthLimit, Infinity);
          delete envSource.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT;
          delete envSource.OTEL_SPAN_ATTRIBUTE_VALUE_LENGTH_LIMIT;
        });
      });

      describe('when attribute value length limit is not defined via env', () => {
        it('should use default value of Infinity', () => {
          const tracer = new BasicTracerProvider().getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeValueLengthLimit, Infinity);
          assert.strictEqual(spanLimits.attributeValueLengthLimit, Infinity);
        });
      });

      describe('when attribute count limit is defined via env', () => {
        it('should general attribute count limit as defined with env', () => {
          envSource.OTEL_ATTRIBUTE_COUNT_LIMIT = '25';
          const tracer = new BasicTracerProvider({}).getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeCountLimit, 25);
          delete envSource.OTEL_ATTRIBUTE_COUNT_LIMIT;
        });
        it('should have span attribute count limit value same as general limit value', () => {
          envSource.OTEL_ATTRIBUTE_COUNT_LIMIT = '20';
          const tracer = new BasicTracerProvider().getTracer('default');
          const generalLimits = tracer.getGeneralLimits();
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(generalLimits.attributeCountLimit, 20);
          assert.strictEqual(spanLimits.attributeCountLimit, 20);
          delete envSource.OTEL_ATTRIBUTE_COUNT_LIMIT;
        });
        it('should have span and general attribute count limits as defined in env', () => {
          envSource.OTEL_ATTRIBUTE_COUNT_LIMIT = '20';
          envSource.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT = '35';
          const tracer = new BasicTracerProvider().getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeCountLimit, 20);
          assert.strictEqual(spanLimits.attributeCountLimit, 35);
          delete envSource.OTEL_ATTRIBUTE_COUNT_LIMIT;
          delete envSource.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT;
        });
        it('should have span attribute count limit as default of 128', () => {
          envSource.OTEL_ATTRIBUTE_COUNT_LIMIT = '20';
          envSource.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT = '128';
          const tracer = new BasicTracerProvider().getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeCountLimit, 20);
          assert.strictEqual(spanLimits.attributeCountLimit, 128);
          delete envSource.OTEL_ATTRIBUTE_COUNT_LIMIT;
          delete envSource.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT;
        });
      });

      describe('when attribute count limit is not defined via env', () => {
        it('should use default value of 128', () => {
          const tracer = new BasicTracerProvider().getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          const generalLimits = tracer.getGeneralLimits();
          assert.strictEqual(generalLimits.attributeCountLimit, 128);
          assert.strictEqual(spanLimits.attributeCountLimit, 128);
        });
      });

      describe('when "eventCountLimit" is defined', () => {
        it('should have tracer with defined value', () => {
          const tracer = new BasicTracerProvider({
            spanLimits: {
              eventCountLimit: 300,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.eventCountLimit, 300);
        });
      });

      describe('when "linkCountLimit" is defined', () => {
        it('should have tracer with defined value', () => {
          const tracer = new BasicTracerProvider({
            spanLimits: {
              linkCountLimit: 10,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.linkCountLimit, 10);
        });
      });

      describe('when only generalLimits are defined', () => {
        it('should have span limits as general limits', () => {
          const tracer = new BasicTracerProvider({
            generalLimits: {
              attributeValueLengthLimit: 100,
              attributeCountLimit: 200,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.attributeValueLengthLimit, 100);
          assert.strictEqual(spanLimits.attributeCountLimit, 200);
        });
      });

      describe('when both generalLimits and spanLimits defined', () => {
        it('should have span limits as priority than general limits', () => {
          const tracer = new BasicTracerProvider({
            generalLimits: {
              attributeValueLengthLimit: 100,
              attributeCountLimit: 200,
            },
            spanLimits: {
              attributeValueLengthLimit: 10,
              attributeCountLimit: 20,
            },
          }).getTracer('default');
          const spanLimits = tracer.getSpanLimits();
          assert.strictEqual(spanLimits.attributeValueLengthLimit, 10);
          assert.strictEqual(spanLimits.attributeCountLimit, 20);
        });
      });
    });
  });

  describe('Custom TracerProvider through inheritance', () => {
    beforeEach(() => {
      envSource.OTEL_TRACES_EXPORTER = 'custom-exporter';
      envSource.OTEL_PROPAGATORS = 'custom-propagator';
    });

    afterEach(() => {
      delete envSource.OTEL_TRACES_EXPORTER;
      delete envSource.OTEL_PROPAGATORS;
      sinon.restore();
    });

    it('can be extended by overriding registered components', () => {
      class CustomTracerProvider extends BasicTracerProvider {
        protected static override readonly _registeredPropagators = new Map<
          string,
          () => TextMapPropagator
        >([
          ...BasicTracerProvider._registeredPropagators,
          ['custom-propagator', () => new DummyPropagator()],
        ]);
      }

      const provider = new CustomTracerProvider({});
      assert.ok(
        provider['_getPropagator']('tracecontext') instanceof
          W3CTraceContextPropagator
      );
      /* BasicTracerProvider has no exporters by default, so skipping testing the exporter getter */
      provider.register();
      assert.strictEqual(
        provider['_activeSpanProcessor']['_spanProcessors'].length,
        0
      );

      sinon.assert.calledOnceWithExactly(
        setGlobalPropagatorStub,
        sinon.match.instanceOf(DummyPropagator)
      );
    });

    it('the old way of extending still works', () => {
      // this is an anti-pattern, but we test that for backwards compatibility
      class CustomTracerProvider extends BasicTracerProvider {
        protected static override readonly _registeredPropagators = new Map<
          string,
          () => TextMapPropagator
        >([['custom-propagator', () => new DummyPropagator()]]);

        protected override _getPropagator(
          name: string
        ): TextMapPropagator | undefined {
          return (
            super._getPropagator(name) ||
            CustomTracerProvider._registeredPropagators.get(name)?.()
          );
        }
      }

      const provider = new CustomTracerProvider({});
      provider.register();
      assert.strictEqual(
        provider['_activeSpanProcessor']['_spanProcessors'].length,
        0
      );

      sinon.assert.calledOnceWithExactly(
        setGlobalPropagatorStub,
        sinon.match.instanceOf(DummyPropagator)
      );
    });
  });

  describe('.register()', () => {
    describe('propagator', () => {
      let originalPropagators: string | number | undefined | string[];
      beforeEach(() => {
        originalPropagators = envSource.OTEL_PROPAGATORS;
      });

      afterEach(() => {
        sinon.restore();

        // otherwise we may assign 'undefined' (a string)
        if (originalPropagators !== undefined) {
          envSource.OTEL_PROPAGATORS = originalPropagators;
        } else {
          delete envSource.OTEL_PROPAGATORS;
        }
      });

      it('should be set to a given value if it it provided', () => {
        const provider = new BasicTracerProvider();
        provider.register({
          propagator: new DummyPropagator(),
        });

        sinon.assert.calledOnceWithExactly(
          setGlobalPropagatorStub,
          sinon.match.instanceOf(DummyPropagator)
        );
      });

      it('should be composite if 2 or more propagators provided in an environment variable', () => {
        const provider = new BasicTracerProvider();
        provider.register();

        sinon.assert.calledOnceWithExactly(
          setGlobalPropagatorStub,
          sinon.match.instanceOf(CompositePropagator)
        );
        assert.deepStrictEqual(setGlobalPropagatorStub.args[0][0].fields(), [
          'traceparent',
          'tracestate',
          'baggage',
        ]);
      });

      it('warns if there is no propagator registered with a given name', () => {
        const warnStub = sinon.spy(diag, 'warn');

        envSource.OTEL_PROPAGATORS = 'missing-propagator';
        const provider = new BasicTracerProvider({});
        provider.register();

        sinon.assert.calledOnceWithExactly(
          warnStub,
          'Propagator "missing-propagator" requested through environment variable is unavailable.'
        );
      });
    });
  });

  describe('.startSpan()', () => {
    it('should start a span with name only', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span');
      assert.ok(span);
      assert.ok(span instanceof SpanImpl);
    });

    it('should propagate resources', () => {
      const tracerProvider = new BasicTracerProvider();
      const tracer = tracerProvider.getTracer('default');
      const span = tracer.startSpan('my-span') as Span;
      assert.strictEqual(tracer['_resource'], tracerProvider['_resource']);
      assert.strictEqual(span.resource, tracerProvider['_resource']);
    });

    it('should start a span with name and options', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span', {});
      assert.ok(span);
      assert.ok(span instanceof SpanImpl);
      const context = span.spanContext();
      assert.ok(context.traceId.match(/[a-f0-9]{32}/));
      assert.ok(context.spanId.match(/[a-f0-9]{16}/));
      assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
      assert.deepStrictEqual(context.traceState, undefined);
      span.end();
    });

    it('should start a span with given attributes', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span', {
        attributes: { foo: 'foo', bar: 'bar' },
      }) as Span;
      assert.deepStrictEqual(span.attributes, { bar: 'bar', foo: 'foo' });
      span.end();
    });

    it('should start a span with spanoptions->attributes', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span', {
        attributes: { foo: 'foo', bar: 'bar' },
      }) as Span;
      assert.deepStrictEqual(span.attributes, { foo: 'foo', bar: 'bar' });
      span.end();
    });

    it('should start a span with name and parent spancontext', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const state = new TraceState('a=1,b=2');

      const span = tracer.startSpan(
        'my-span',
        {},
        trace.setSpanContext(ROOT_CONTEXT, {
          traceId: 'd4cda95b652f4a1592b449d5929fda1b',
          spanId: '6e0c63257de34c92',
          traceFlags: TraceFlags.SAMPLED,
          traceState: state,
        })
      );
      assert.ok(span instanceof SpanImpl);
      const context = span.spanContext();
      assert.strictEqual(context.traceId, 'd4cda95b652f4a1592b449d5929fda1b');
      assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
      assert.deepStrictEqual(context.traceState, state);
      span.end();
    });

    it('should start a span with name and parent span', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span');
      const childSpan = tracer.startSpan(
        'child-span',
        {},
        trace.setSpan(ROOT_CONTEXT, span)
      );
      const context = childSpan.spanContext();
      assert.strictEqual(context.traceId, span.spanContext().traceId);
      assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
      span.end();
      childSpan.end();
    });

    it('should create a root span when root is true', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span');
      const overrideParent = tracer.startSpan('my-parent-override-span');
      const rootSpan = tracer.startSpan(
        'root-span',
        { root: true },
        trace.setSpan(ROOT_CONTEXT, span)
      );
      const context = rootSpan.spanContext();
      assert.notStrictEqual(
        context.traceId,
        overrideParent.spanContext().traceId
      );
      span.end();
      rootSpan.end();
    });

    it('should start a span with name and with invalid parent span', () => {
      const tracer = new BasicTracerProvider({
        sampler: new AlwaysOnSampler(),
      }).getTracer('default');
      const span = tracer.startSpan(
        'my-span',
        {},
        trace.setSpanContext(
          ROOT_CONTEXT,
          'invalid-parent' as unknown as SpanContext
        )
      );
      assert.ok(span instanceof SpanImpl);
      assert.deepStrictEqual((span as Span).parentSpanId, undefined);
    });

    it('should start a span with name and with invalid spancontext', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan(
        'my-span',
        {},
        trace.setSpanContext(ROOT_CONTEXT, {
          traceId: '0',
          spanId: '0',
          traceFlags: TraceFlags.SAMPLED,
        })
      );
      assert.ok(span instanceof SpanImpl);
      const context = span.spanContext();
      assert.ok(context.traceId.match(/[a-f0-9]{32}/));
      assert.ok(context.spanId.match(/[a-f0-9]{16}/));
      assert.strictEqual(context.traceFlags, TraceFlags.SAMPLED);
      assert.deepStrictEqual(context.traceState, undefined);
    });

    it('should return a non recording span when never sampling', () => {
      const tracer = new BasicTracerProvider({
        sampler: new AlwaysOffSampler(),
      }).getTracer('default');
      const span = tracer.startSpan('my-span');
      assert.ok(!span.isRecording());
      const context = span.spanContext();
      assert.ok(context.traceId.match(/[a-f0-9]{32}/));
      assert.ok(context.spanId.match(/[a-f0-9]{16}/));
      assert.strictEqual(context.traceFlags, TraceFlags.NONE);
      assert.deepStrictEqual(context.traceState, undefined);
      span.end();
    });

    it('should create real span when sampled', () => {
      const tracer = new BasicTracerProvider({
        sampler: new AlwaysOnSampler(),
      }).getTracer('default');
      const span = tracer.startSpan('my-span');
      assert.ok(span instanceof SpanImpl);
      assert.strictEqual(span.spanContext().traceFlags, TraceFlags.SAMPLED);
      assert.strictEqual(span.isRecording(), true);
    });

    it('should assign a resource', () => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span') as Span;
      assert.ok(span);
      assert.ok(span.resource instanceof Resource);
    });
  });

  describe('.withSpan()', () => {
    it('should run context with NoopContextManager context manager', done => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span');
      context.with(trace.setSpan(context.active(), span), () => {
        assert.deepStrictEqual(trace.getSpan(context.active()), undefined);
        return done();
      });
    });
  });

  describe('.forceFlush()', () => {
    it('should call forceFlush on all registered span processors', done => {
      sinon.restore();
      const forceFlushStub = sinon.stub(
        NoopSpanProcessor.prototype,
        'forceFlush'
      );
      forceFlushStub.resolves();

      const spanProcessorOne = new NoopSpanProcessor();
      const spanProcessorTwo = new NoopSpanProcessor();
      const tracerProvider = new BasicTracerProvider({
        spanProcessors: [spanProcessorOne, spanProcessorTwo],
      });

      tracerProvider
        .forceFlush()
        .then(() => {
          sinon.restore();
          assert.ok(forceFlushStub.calledTwice);
          done();
        })
        .catch(error => {
          sinon.restore();
          done(error);
        });
    });

    it('should throw error when calling forceFlush on all registered span processors fails', done => {
      sinon.restore();

      const forceFlushStub = sinon.stub(
        NoopSpanProcessor.prototype,
        'forceFlush'
      );
      forceFlushStub.returns(Promise.reject('Error'));

      const spanProcessorOne = new NoopSpanProcessor();
      const spanProcessorTwo = new NoopSpanProcessor();
      const tracerProvider = new BasicTracerProvider({
        spanProcessors: [spanProcessorOne, spanProcessorTwo],
      });

      tracerProvider
        .forceFlush()
        .then(() => {
          sinon.restore();
          done(new Error('Successful forceFlush not expected'));
        })
        .catch(_error => {
          sinon.restore();
          sinon.assert.calledTwice(forceFlushStub);
          done();
        });
    });
  });

  describe('.bind()', () => {
    it('should bind context with NoopContextManager context manager', done => {
      const tracer = new BasicTracerProvider().getTracer('default');
      const span = tracer.startSpan('my-span');
      const fn = () => {
        assert.deepStrictEqual(trace.getSpan(context.active()), undefined);
        return done();
      };
      const patchedFn = context.bind(trace.setSpan(context.active(), span), fn);
      return patchedFn();
    });
  });

  describe('.resource', () => {
    it('should use the default resource when no resource is provided', function () {
      const tracerProvider = new BasicTracerProvider();
      assert.deepStrictEqual(tracerProvider['_resource'], Resource.default());
    });

    it('should use not use the default if resource passed', function () {
      const providedResource = new Resource({ foo: 'bar' });
      const tracerProvider = new BasicTracerProvider({
        resource: providedResource,
      });
      assert.deepStrictEqual(tracerProvider['_resource'], providedResource);
    });
  });

  describe('.shutdown()', () => {
    it('should trigger shutdown when manually invoked', () => {
      const tracerProvider = new BasicTracerProvider();
      const shutdownStub = sinon.stub(
        tracerProvider['_activeSpanProcessor'],
        'shutdown'
      );
      tracerProvider.shutdown();
      sinon.assert.calledOnce(shutdownStub);
    });
  });
});
