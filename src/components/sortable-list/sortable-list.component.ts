import {Component, ElementRef, EventEmitter, Input, Output} from 'angular2/core';
const sortable: Sortablejs.Sortable = require('sortablejs');

type sortFn = (source: T[], byReference: boolean) => T[];

/**
 * The event object returned by each of the Sortablejs callbacks, which can then be emitted up
 * to the consuming component.
 */
export interface ISortableEvent {
    bubbles: boolean;
    cancelBubble: boolean;
    cancelable: boolean;
    clone: any;
    currentTarget: any;
    defaultPrevented: boolean;
    eventPhase: number;
    from: Element;
    isTrusted: boolean;
    item: Element;
    newIndex: number;
    oldIndex: number;
    path: Element[];
    returnValue: any;
    srcElement: Element;
    target: Element;
    timeStamp: number;
    to: Element;
    type: 'start' | 'move' | 'sort' | 'update' | 'end' | 'add' | 'remove' | 'filter';
    /**
     * The sort function is a convenience method for sorting an array, so that the consumer
     * of this component does not have to re-implement array sorting each time the component is used.
     *
     * The sort function expects and array, and returns a new copy of that array, unless
     * `byReference === true`, in which case the array is mutated.
     */
    sort: sortFn;
}

export interface ISortableMoveEvent extends ISortableEvent {
    dragged: Element;
    draggedRect: ClientRect;
    related: Element;
    relatedRect: ClientRect;
}

@Component({
    selector: 'gtx-sortable-list',
    template: require('./sortable-list.tpl.html')
})
export class SortableList {

    @Input() disabled: boolean = false;
    @Output() dragEnd: EventEmitter<ISortableEvent> = new EventEmitter();
    sortable: Sortablejs.Sortable;

    constructor(private elementRef: ElementRef) {}

    ngOnChanges(): void {
        if (this.sortable) {
            this.sortable.option('disabled', this.disabled);
        }
    }

    ngOnInit(): void {
        this.sortable = (<any> sortable).create(this.elementRef.nativeElement, {
            animation: 150,
            setData: (dataTransfer: any, dragEl: Element) => {
                this.setInvisibleDragImage(dataTransfer);
            },
            // dragging started
            onStart: (e: ISortableEvent) => {},
            // dragging ended
            onEnd: (e: ISortableEvent) => {
                e.sort = this.sortFactory(e);
                this.dragEnd.emit(e);
            },
            // Element is dropped into the list from another list
            onAdd: (e: ISortableEvent) => {},
            // Changed sorting within list
            onUpdate: (e: ISortableEvent) => {},
            // Called by any change to the list (add / update / remove)
            onSort: (e: ISortableEvent) => {},
            // Element is removed from the list into another list
            onRemove: (e: ISortableEvent) => {},
            // Attempt to drag a filtered element
            onFilter: (e: ISortableEvent) => {},
            // Event when you move an item in the list or between lists
            onMove: (e: ISortableMoveEvent) => {
                // Example: http://jsbin.com/tuyafe/1/edit?js,output
                e.dragged; // dragged HTMLElement
                e.draggedRect; // TextRectangle {left, top, right и bottom}
                e.related; // HTMLElement on which have guided
                e.relatedRect; // TextRectangle
                // return false; — for cancel
            }
        });
    }

    ngAfterContentInit(): void {
        let dragHandles = this.elementRef.nativeElement.querySelectorAll('gtx-drag-handle');
        if (dragHandles && 0 < dragHandles.length) {
            this.sortable.option('handle', '.gtx-drag-handle');
        }
    }

    /**
     * Returns a pre-configured sort function which uses the indexes of the sort operation.
     */
    sortFactory(e: ISortableEvent): sortFn {
        return (source: any[], byReference: boolean = false) => {
            let result: any[] = byReference ? source : source.slice();
            let {oldIndex, newIndex}: number = e;

            // Check that index i is an integer
            const isInt = (i: any): boolean => Number(i) === i && i % 1 === 0;
            // Check that index i is within the bounds of the array
            const inBounds = (i: number): boolean => 0 <= i && i < result.length;
            // Valid if numeric and in bounds
            const valid = (i: any): boolean => isInt(i) && inBounds(i);

            if (oldIndex !== newIndex && valid(oldIndex) && valid(newIndex)) {
                let item: any = result[newIndex];
                result[newIndex] = result[oldIndex];
                result[oldIndex] = item;
            }

            return result;
        };
    }

    /**
     * Remove the default browser drag image, to give the impression that movement
     * is locked to the vertical axis.
     */
    private setInvisibleDragImage(dataTransfer: any): void {
        let canvas: HTMLCanvasElement = <HTMLCanvasElement> document.createElement('canvas');
        canvas.width = canvas.height = 0;
        dataTransfer.setData('text/plain', 'Data to Drag');
        dataTransfer.setDragImage(canvas, 25, 25);
    }
}

@Component({
    selector: 'gtx-drag-handle',
    template: `<div class="gtx-drag-handle"><i class="material-icons">drag_handle</i></div>`
})
export class SortableListDragHandle {}