import { Button, IconChevronLeft, IconChevronRight } from "@humansignal/ui";
import { observer } from "mobx-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Block, Elem } from "../../utils/bem";
import { clamp, sortAnnotations } from "../../utils/utilities";
import { AnnotationButton } from "./AnnotationButton";
import "./AnnotationsCarousel.scss";

interface AnnotationsCarouselInterface {
  store: any;
  annotationStore: any;
  commentStore?: any;
}

export const AnnotationsCarousel = observer(({ store, annotationStore }: AnnotationsCarouselInterface) => {
  const [entities, setEntities] = useState<any[]>([]);
  const enableAnnotations = store.hasInterface("annotations:tabs");
  const enablePredictions = store.hasInterface("predictions:tabs");
  const enableCreateAnnotation = store.hasInterface("annotations:add-new");
  const groundTruthEnabled = store.hasInterface("ground-truth");
  const enableAnnotationDelete = store.hasInterface("annotations:delete");
  const carouselRef = useRef<HTMLElement>();
  const containerRef = useRef<HTMLElement>();
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isLeftDisabled, setIsLeftDisabled] = useState(false);
  const [isRightDisabled, setIsRightDisabled] = useState(false);

  const updatePosition = useCallback(
    (e: React.MouseEvent, goLeft = true) => {
      if (containerRef.current && carouselRef.current) {
        const step = containerRef.current.clientWidth;
        const carouselWidth = carouselRef.current.clientWidth;
        const newPos = clamp(goLeft ? currentPosition - step : currentPosition + step, 0, carouselWidth - step);

        setCurrentPosition(newPos);
      }
    },
    [containerRef, carouselRef, currentPosition],
  );

  useEffect(() => {
    setIsLeftDisabled(currentPosition <= 0);
    setIsRightDisabled(
      currentPosition >= (carouselRef.current?.clientWidth ?? 0) - (containerRef.current?.clientWidth ?? 0),
    );
  }, [
    entities.length,
    containerRef.current,
    carouselRef.current,
    currentPosition,
    window.innerWidth,
    window.innerHeight,
  ]);

  useEffect(() => {
    const newEntities = [];

    if (enablePredictions) newEntities.push(...annotationStore.predictions);

    if (enableAnnotations) newEntities.push(...annotationStore.annotations);
    setEntities(newEntities);
  }, [annotationStore, JSON.stringify(annotationStore.predictions), JSON.stringify(annotationStore.annotations)]);

  return enableAnnotations || enablePredictions || enableCreateAnnotation ? (
    <Block name="annotations-carousel" style={{ "--carousel-left": `${currentPosition}px` }}>
      <Elem ref={containerRef} name="container">
        <Elem ref={carouselRef} name="carosel">
          {sortAnnotations(entities).map((entity) => (
            <AnnotationButton
              key={entity?.id}
              entity={entity}
              capabilities={{
                enablePredictions,
                enableCreateAnnotation,
                groundTruthEnabled,
                enableAnnotations,
                enableAnnotationDelete,
              }}
              annotationStore={annotationStore}
            />
          ))}
        </Elem>
      </Elem>
      {(!isLeftDisabled || !isRightDisabled) && (
        <Elem name="carousel-controls">
          <Button
            disabled={isLeftDisabled}
            aria-label="Carousel left"
            size="small"
            variant="neutral"
            onClick={(e) => !isLeftDisabled && updatePosition(e, true)}
          >
            <IconChevronLeft />
          </Button>
          <Button
            disabled={isRightDisabled}
            aria-label="Carousel right"
            size="small"
            variant="neutral"
            onClick={(e) => !isRightDisabled && updatePosition(e, false)}
          >
            <IconChevronRight />
          </Button>
        </Elem>
      )}
    </Block>
  ) : null;
});
